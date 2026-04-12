# 家族迁徙平台 · SQL 部署文档

> 本文档整理所有 SQL 脚本的执行顺序、功能描述和使用场景，用于生产环境部署和数据同步。

---

## 📋 执行顺序总览

| 顺序 | 文件名 | 用途 | 执行时机 | 是否必需 |
|------|--------|------|----------|----------|
| 1 | `deploy.sql` | 完整数据库部署（含表结构 + 预置数据） | 新环境首次部署 | ✅ 必需 |
| 2 | `alter-story-chapters.sql` | 扩展 story_chapters 表（叙事意图 Agent 支持） | Phase 1 功能上线 | ✅ 必需 |
| 3 | `data-health.sql` | 数据健康检查 | 日常运维/数据验收 | ⭕ 可选 |
| 4 | `fix-coords-prod.sql` | 修复缺失坐标（黑龙江双城等） | 坐标数据修复 | ⭕ 按需 |
| 5 | `check-family.sql` | 查询指定家族数据 | 问题排查/数据验证 | ⭕ 按需 |
| 6 | `schema.sql` | 建库语句参考（只读模板） | 开发/文档参考 | ℹ️ 参考 |

---

## 📁 文件详解

### 1. `deploy.sql` - 完整部署脚本

**用途：** 新环境从零部署数据库，包含所有表结构、索引、触发器、视图和预置历史事件数据

**适用场景：**
- 新生产环境首次部署
- 本地开发环境初始化
- 灾备环境重建

**执行命令：**
```bash
# 1. 创建数据库
createdb -U postgres family_migration

# 2. 执行部署脚本
psql -U postgres -d family_migration -f deploy.sql
```

**包含内容：**
- ✅ 11 张核心表（users, family_profiles, persons, places, migrations, relationships, historical_events, story_chapters, chat_sessions）
- ✅ UUID 和 pg_trgm 扩展
- ✅ 自动更新触发器（updated_at）
- ✅ v_migration_paths 视图
- ✅ 16 条中国近现代历史事件预置数据

**注意事项：**
- 使用 `CREATE TABLE IF NOT EXISTS`，支持重复执行
- 历史事件使用 `WHERE NOT EXISTS` 避免重复插入

---

### 2. `alter-story-chapters.sql` - 叙事意图 Agent 表结构扩展

**用途：** 为 `story_chapters` 表添加 AI 生成字段支持，创建独立故事表

**适用场景：**
- Phase 1（叙事意图 Agent）功能上线
- 生产环境需要同步此扩展

**执行命令：**
```bash
psql -U postgres -d family_migration -f alter-story-chapters.sql
```

**新增字段：**
| 表 | 字段 | 类型 | 说明 |
|----|------|------|------|
| story_chapters | emotion_tags | JSONB | AI 生成的情绪标签数组，如 `["struggle", "hope"]` |
| story_chapters | historical_context | JSONB | AI 生成的历史背景对象 |
| story_chapters | story_id | UUID | 关联独立故事表的 ID |
| stories | (新表) | - | 独立故事表（不绑定迁徙的纯故事） |

**新增索引：**
- `idx_story_chapters_emotion_tags` (GIN) - 支持情绪标签复合查询

**注意事项：**
- ✅ 所有操作使用 `IF NOT EXISTS`，支持重复执行
- ⚠️ `stories` 表如果不存在会自动创建
- ⚠️ 外键约束被注释掉，如需启用请取消注释

---

### 3. `data-health.sql` - 数据健康检查工具

**用途：** 检查数据完整性、识别孤儿数据、统计行数

**适用场景：**
- 日常运维巡检
- 数据验收/交付前检查
- 问题排查

**执行命令：**
```bash
psql -U postgres -d family_migration -f data-health.sql
```

**检查项目：**
1. 缺少坐标的迁徙记录
2. 家族数据完整性（家族名、状态、人物数、迁徙数、会话数）
3. 孤儿数据检查（孤儿人物、孤儿地点、孤儿家族、过期会话）
4. 表行数统计

**注意事项：**
- ⚠️ 默认只读检查，不修改数据
- 🛠️ 清理脚本已注释，如需清理请取消注释并**先备份数据**

---

### 4. `fix-coords-prod.sql` - 坐标修复脚本

**用途：** 修复"黑龙江双城"等地点的缺失坐标

**适用场景：**
- 地图渲染失败
- 地理编码遗留问题
- 手动修复缺失坐标

**执行命令：**
```bash
psql -U postgres -d family_migration -f fix-coords-prod.sql
```

**修复内容：**
- 插入"黑龙江双城" → "哈尔滨市双城区"坐标 (126.2247, 45.3522)
- 更新 migrations 表关联新地点 ID

**验证方法：**
执行后会输出所有迁徙记录的坐标状态（已修复/仍缺坐标）

---

### 5. `check-family.sql` - 家族数据查询工具

**用途：** 查询指定 familyId 的完整数据（含坐标检查）

**适用场景：**
- 用户反馈问题排查
- 数据验证
- 地理编码失败原因分析

**执行命令：**
```bash
# 替换 <your-family-id> 为实际 UUID
psql -U aifeisu -d family_migration \
  -v fid="'<your-family-id>'" \
  -f sql/check-family.sql
```

**输出内容：**
1. 家族档案基本信息
2. 家族成员列表（按代际排序）
3. 迁徙记录与坐标状态（✓/✗）
4. 地点缓存明细
5. 坐标缺失统计
6. 需要重新地理编码的地名列表

**注意事项：**
- 默认查询 `fid='feb7d4e6-7891-4bb0-b8e9-670e965b665d'`
- 可通过 `-v fid="'xxx'"` 参数覆盖

---

### 6. `schema.sql` - 建库语句参考

**用途：** 数据库建表完整语句（含预置数据 INSERT）

**适用场景：**
- 开发参考
- 文档查阅
- 表结构审计

**注意事项：**
- ⚠️ 此文件为**只读参考**，不建议直接执行（无 IF NOT EXISTS 保护）
- 生产部署请使用 `deploy.sql`

---

## 🚀 生产环境部署流程

### 新环境首次部署

```bash
# 1. 创建数据库
createdb -U postgres family_migration

# 2. 执行基础部署
psql -U postgres -d family_migration -f deploy.sql

# 3. 执行叙事意图 Agent 扩展
psql -U postgres -d family_migration -f alter-story-chapters.sql

# 4. 验证部署
psql -U postgres -d family_migration -f data-health.sql
```

### 现有环境升级（Phase 1）

```bash
# 仅执行新增的扩展
psql -U postgres -d family_migration -f alter-story-chapters.sql

# 验证扩展结果
psql -U postgres -d family_migration -c "\d story_chapters"
psql -U postgres -d family_migration -c "SELECT COUNT(*) FROM stories;"
```

### 问题排查流程

```bash
# 1. 检查指定家族数据
psql -U aifeisu -d family_migration \
  -v fid="'<family-id>'" \
  -f sql/check-family.sql

# 2. 如有坐标问题，执行修复
psql -U postgres -d family_migration -f fix-coords-prod.sql

# 3. 全面健康检查
psql -U postgres -d family_migration -f data-health.sql
```

---

## 📊 表结构关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        users                                │
│  (用户账户，可选)                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ (可选关联)
┌─────────────────────▼───────────────────────────────────────┐
│                   family_profiles                           │
│  (家族档案 - 核心数据)                                       │
└────┬──────────────┬────────────────────┬────────────────────┘
     │              │                    │
     │              │                    │
┌────▼────┐  ┌─────▼──────────┐  ┌──────▼────────┐
│ persons │  │   migrations   │  │ chat_sessions │
│ (成员)  │  │   (迁徙事件)    │  │   (对话会话)  │
└────┬────┘  └─────┬─────┬────┘  └───────────────┘
     │             │     │
     │        ┌────▼─┐ ┌▼────┐
     │        │places│ │     │
     │        │(地点)│ │     │
     │        └──────┘ │     │
     │                 │     │
┌────▼─────────────────▼─────▼─────────────────────────────┐
│                    story_chapters                         │
│  (叙事章节 - AI 生成内容)                                   │
│  - emotion_tags (JSONB)    [新增]                         │
│  - historical_context (JSONB) [新增]                       │
│  - story_id (UUID)         [新增]                         │
└───────────────────────────────────────────────────────────┘
                      ▲
                      │
               ┌──────┴──────────┐
               │    stories      │
               │ (独立故事表)     │
               │ [新增]          │
               └─────────────────┘
```

---

## 🔐 安全与备份

### 备份建议

```bash
# 完整备份
pg_dump -U postgres family_migration > backup_$(date +%Y%m%d).sql

# 仅表结构
pg_dump -U postgres -s family_migration > schema_only.sql

# 仅数据
pg_dump -U postgres -a family_migration > data_only.sql
```

### 恢复数据

```bash
psql -U postgres -d family_migration -f backup_20260410.sql
```

---

## 📝 版本历史

| 日期 | 变更 | 对应文件 |
|------|------|----------|
| 2024-xx-xx | 初始建库 | schema.sql |
| 2024-xx-xx | 完整部署脚本 | deploy.sql |
| 2025-xx-xx | 叙事意图 Agent 扩展 | alter-story-chapters.sql |
| 2025-xx-xx | 黑龙江双城坐标修复 | fix-coords-prod.sql |
| 2026-04-10 | 整理部署文档 | 本文档 |

---

## 📞 问题反馈

如遇数据库部署问题，请检查：
1. PostgreSQL 版本 ≥ 14
2. 已安装 `uuid-ossp` 和 `pg_trgm` 扩展
3. 数据库用户有足够权限创建表、索引、视图
