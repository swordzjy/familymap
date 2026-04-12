# 2026-04-12 工作总结

## 一、数据库修复

### 1.1 修复田省美重复记录
- **问题**: 数据库中有两条"田省美"记录（一条 role=母亲，一条 role=其他）
- **解决**: 删除 role=其他 的错误记录及其关联的 relationships
- **SQL**: 
  ```sql
  DELETE FROM relationships WHERE id = '3d9090ff-966f-4e68-9e38-f5e32bf6b030';
  DELETE FROM persons WHERE id = 'e0abcc0c-f7fb-482a-b5dc-205c9133259e';
  ```

### 1.2 修正代际值
- **问题**: 数据库中 generation 符号错误（父辈=1 应为 -1，祖辈=2 应为 -2）
- **解决**: 更新主家庭 (family_id=1df5a6b8) 的 generation 值
  - 田省美（母亲）：1 → -1
  - 父亲：1 → -1
  - 爷爷/奶奶/外公/外婆：2 → -2

### 1.3 修正妻子角色
- **问题**: 田梅的 role 为"其他"而非"妻子"
- **解决**: 
  ```sql
  UPDATE persons SET role = '妻子' WHERE id = '09f40c64-0182-43e6-a251-3fd37e874baf';
  ```

---

## 二、后端修复 (server.js)

### 2.1 集成 KinshipDB 动态映射
**问题**: `inferGenderFromRole` 和 `mapRoleToRelationType` 使用硬编码列表，无法识别"大舅哥"等复杂关系

**解决方案**: 从 KinshipDB 动态生成映射表

```javascript
// 引入 KinshipDB 单例
const { KinshipDB: kinshipDB } = require('./utils/kinship-db');

// 构建角色→relationType 映射表 (363 个关系)
const ROLE_TO_RELATION_TYPE = new Map();
function initRelationTypeMap() {
  const allRelations = kinshipDB.getAll();
  allRelations.forEach(rel => {
    ROLE_TO_RELATION_TYPE.set(rel.displayName, rel.id);
    rel.aliases.forEach(alias => {
      const cleanAlias = alias.replace(/(我叫 | 我是 | 我的名字是 | 的)$/, '');
      if (cleanAlias) ROLE_TO_RELATION_TYPE.set(cleanAlias, rel.id);
    });
  });
}

// 构建性别映射表 (177 男/182 女)
const MALE_ROLES = new Set();
const FEMALE_ROLES = new Set();

// 构建代际映射表 (363 个)
const ROLE_TO_GENERATION = new Map();
```

**效果**:
- `mapRoleToRelationType("妻子")` → `"spouse_female"` ✓
- `mapRoleToRelationType("大舅子")` → `"brother_in_law_wife_elder"` ✓
- `inferGenderFromRole("妻子")` → `"female"` ✓
- `inferGenderFromRole("大舅子")` → `"male"` ✓

### 2.2 修复 API 数据转换
**问题**: `/migration-map` 和 `/family-members` API 返回的 generation 符号错误，relationType 为 unknown

**解决**: 在 API 响应前进行数据修复
```javascript
const personMap = new Map();
for (const m of persons.rows) {
  const dbGen = m.generation !== null ? (m.generation > 0 ? -m.generation : m.generation) : null;
  const mappedGen = mapRoleToGeneration(m.role);
  const finalGen = dbGen !== null ? dbGen : mappedGen;
  const relationType = mapRoleToRelationType(m.role);
  // 优先保留 relationType 明确的记录
}
```

---

## 三、前端修复

### 3.1 story-timeline.html

#### 问题 1: 代际标签错误
- **现象**: 妻子田梅的代际标签显示为"本人"
- **原因**: `genLabelMap[0] = '本人'`，配偶 generation=0 但不应显示为"本人"
- **修复**:
```javascript
function getGenLabel(person) {
  if (person.role === '妻子' || person.role === '丈夫' || person.role === '配偶') {
    return '配偶';
  }
  return genLabelMap[person.generation] || `第${person.generation}代`;
}
```

#### 问题 2: 代际映射反向
- **现象**: 父辈显示为"子辈"，祖辈显示为"孙辈"
- **原因**: `genLabelMap` 使用正数键（1=父辈），但 API 返回负数（-1=父辈）
- **修复**:
```javascript
const genLabelMap = {
  '-4': '太祖辈', '-3': '曾祖辈', '-2': '祖辈', '-1': '父辈',
  '0': '本人',
  '1': '子辈', '2': '孙辈', '3': '曾孙辈',
};
```

#### 问题 3: 排序反向
- **现象**: 晚辈在前，长辈在后
- **原因**: 排序使用 `(b.generation || 0) - (a.generation || 0)`
- **修复**: `(a.generation || 0) - (b.generation || 0)`（负数在前=长辈在前）

#### 问题 4: 数据同步
- **现象**: story-timeline 修改后，mobile-chat 缓存未更新
- **修复**: 添加 `syncFamilyCache()` 函数
```javascript
function syncFamilyCache() {
  const cacheKey = 'family_migration_chat_state';
  const saved = localStorage.getItem(cacheKey);
  if (saved && parsed.familyId === familyId) {
    parsed.familyData = {
      family_name: currentData.family_name,
      persons: currentData.persons,
      migrations: currentData.migrations,
      relationships: currentData.relationships,
    };
    localStorage.setItem(cacheKey, JSON.stringify(parsed));
  }
}
```

### 3.2 family-tree.html
- 新增家族树可视化入口按钮
- 修复 script 路径（`../js/visualization.js`）
- 添加 gender 推断函数

---

## 四、测试验证

### 4.1 API 测试
```bash
curl http://localhost:3005/amapapi/family-members/1df5a6b8-a833-445d-803c-8afdb6320492
```

**输出**:
```json
{
  "members": [
    {"name": "田梅", "relation": "妻子", "relationType": "spouse_female", "gender": "female", "generation": 0},
    {"name": "周本人", "relation": "本人", "relationType": "self", "generation": 0},
    {"name": "周爸爸", "relation": "父亲", "relationType": "father", "gender": "male", "generation": -1},
    ...
  ]
}
```

### 4.2 前端显示验证
- ✅ 妻子田梅显示为"田梅"（非"本人"）
- ✅ 代际标签显示为"配偶"（非"本人"）
- ✅ 家族树正确显示夫妻关系连线
- ✅ 长辈（-2, -1）在前，晚辈在后

---

## 五、提交记录

```
commit a4182ab
Author: swordzjy <zhoujianyu@gmail.com>
Date:   Sun Apr 12 22:20:17 2026 +0800

    fix: 修复家族关系识别和代际标签显示
    
    后端 (server.js):
    - 集成 KinshipDB 动态生成角色映射表 (363 个关系)
    - mapRoleToRelationType: 从 KinshipDB 读取所有 aliases 映射
    - inferGenderFromRole: 从 KinshipDB 读取性别 (177 男/182 女)
    - mapRoleToGeneration: 从 KinshipDB 读取代际映射
    - 修复妻子/丈夫关系识别 (spouse_female/spouse_male)
    - 修复家族成员 API 的 generation 符号转换
    
    前端 (story-timeline.html):
    - 修复代际标签：配偶显示"配偶"而非"本人"
    - 修正代际映射：负数=长辈 (-1 父辈，-2 祖辈)
    - 修正排序：generation 越小辈分越高 (祖先在前)
    - 添加 family-tree.html 入口按钮
    
    前端 (mobile-chat.html):
    - syncFamilyCache: 保存后同步更新 localStorage
```

---

## 六、待办事项

### 未完成功能
- [ ] #21 实现断点续聊机制
- [ ] #47 存在时刻页面设计
- [ ] #22 实现故事钩子开场白
- [ ] #50 集成 funasr 声纹 Agent
- [ ] #19 实现示例对话气泡

### 技术债务
- 清理 `backend/server.js.bak` 等备份文件
- 整理 `memory-old/`, `familytree/` 等临时目录
- 删除 `sql/alter-story-chapters.sql` 等已废弃 SQL

---

## 七、关键数据

| 项目 | 数值 |
|------|------|
| KinshipDB 关系总数 | 363 |
| 男性关系 | 177 |
| 女性关系 | 182 |
| 代际映射 | 363 |
| 代码变更 | +297 -18 |
| 修改文件 | 3 |
