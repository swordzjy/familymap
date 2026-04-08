# 数据模型规范

> 版本：1.0.0  
> 最后更新：2026-04-08

---

## 数据库概述

**PostgreSQL 14+**，使用以下扩展：

- `uuid-ossp`：UUID 主键生成
- `pg_trgm`：地名模糊搜索（GIN 索引）

---

## 核心表结构

### users（用户表）

可选的用户表，支持多用户系统。当前项目可暂不使用。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 默认 `uuid_generate_v4()` |
| `email` | VARCHAR(255) | UNIQUE | 邮箱 |
| `nickname` | VARCHAR(100) | | 昵称 |
| `created_at` | TIMESTAMPTZ | | 默认 `NOW()` |
| `updated_at` | TIMESTAMPTZ | | 默认 `NOW()`，触发器更新 |

---

### family_profiles（家族档案表）

核心表：一个家族一份档案。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | 可选，关联用户 |
| `family_name` | VARCHAR(100) | | 姓氏或家族名 |
| `raw_input` | TEXT | | 用户原始叙述文本 |
| `input_mode` | VARCHAR(20) | DEFAULT 'text' | `text` \| `voice` \| `mixed` |
| `ai_confidence` | DECIMAL(3,2) | | AI 解析置信度 0.00-1.00 |
| `status` | VARCHAR(20) | DEFAULT 'processing' | `processing` \| `ready` \| `failed` |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | 触发器更新 |

**索引**：
- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

---

### persons（家族成员表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → family_profiles | |
| `internal_id` | VARCHAR(10) | | AI 分配的临时 ID（如 p1, p2） |
| `role` | VARCHAR(50) | | 爷爷/奶奶/父亲/母亲/本人 |
| `name` | VARCHAR(100) | DEFAULT '未知' | |
| `gender` | VARCHAR(10) | | `male` \| `female` \| `unknown` |
| `birth_year` | INTEGER | | |
| `death_year` | INTEGER | NULL | NULL 表示在世或未知 |
| `birth_place` | VARCHAR(200) | | 原始地名文本 |
| `occupation` | VARCHAR(100) | | |
| `generation` | INTEGER | | 相对用户代际：0=本人，1=父母，-1=子女 |
| `notes` | TEXT | | 额外备注 |
| `created_at` | TIMESTAMPTZ | | |

**索引**：
- `PRIMARY KEY (id)`
- `FOREIGN KEY (family_id) REFERENCES family_profiles(id) ON DELETE CASCADE`
- `INDEX idx_persons_family (family_id)`

---

### places（地点表）

地理编码结果缓存，避免重复查询高德 API。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `raw_name` | VARCHAR(200) | NOT NULL, UNIQUE | 原始地名 |
| `normalized_name` | VARCHAR(200) | | 标准化地名 |
| `province` | VARCHAR(50) | | 省份 |
| `city` | VARCHAR(50) | | 城市 |
| `district` | VARCHAR(50) | | 区县 |
| `longitude` | DECIMAL(10,7) | | 高德返回经度 |
| `latitude` | DECIMAL(10,7) | | 高德返回纬度 |
| `country` | VARCHAR(50) | DEFAULT '中国' | |
| `geocode_source` | VARCHAR(20) | DEFAULT 'amap' | `amap` \| `google` \| `manual` |
| `created_at` | TIMESTAMPTZ | | |

**索引**：
- `PRIMARY KEY (id)`
- `UNIQUE (raw_name)`
- `GIN INDEX idx_places_raw_name (raw_name gin_trgm_ops)` — 模糊搜索

---

### migrations（迁徙事件表）

**核心数据表**：记录每一次迁徙。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → family_profiles | |
| `person_id` | UUID | FK → persons | |
| `from_place_id` | UUID | FK → places | 起点 ID |
| `to_place_id` | UUID | FK → places | 终点 ID |
| `from_place_raw` | VARCHAR(200) | | 起点原始文本（保留） |
| `to_place_raw` | VARCHAR(200) | | 终点原始文本（必填） |
| `year` | INTEGER | | 迁徙年份 |
| `year_approx` | BOOLEAN | DEFAULT FALSE | 是否是估计年份 |
| `reason` | TEXT | | 迁徙原因描述 |
| `reason_type` | VARCHAR(30) | | `study` \| `work` \| `war` \| `disaster` \| `assignment` \| `family` \| `unknown` |
| `emotion_weight` | VARCHAR(10) | DEFAULT 'medium' | `low` \| `medium` \| `high` |
| `sequence_order` | INTEGER | | 在家族迁徙序列中的顺序 |
| `created_at` | TIMESTAMPTZ | | |

**索引**：
- `PRIMARY KEY (id)`
- `FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE`
- `FOREIGN KEY (from_place_id) REFERENCES places(id)`
- `FOREIGN KEY (to_place_id) REFERENCES places(id)`
- `INDEX idx_migrations_family (family_id)`
- `INDEX idx_migrations_person (person_id)`

**数据完整性约束**：
- `to_place_raw` 不能为空
- `year` 应合理（1800-2100）
- `reason_type` 必须是枚举值之一

---

### relationships（家族关系表）

记录家族成员间的关系（未充分使用）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → family_profiles | |
| `from_person_id` | UUID | FK → persons | |
| `to_person_id` | UUID | FK → persons | |
| `relation_type` | VARCHAR(30) | | `parent` \| `spouse` \| `sibling` |
| `created_at` | TIMESTAMPTZ | | |

---

### historical_events（历史事件库）

预置的历史事件，用于丰富叙事背景。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `name` | VARCHAR(200) | NOT NULL | 事件名称 |
| `year_start` | INTEGER | | 开始年份 |
| `year_end` | INTEGER | | 结束年份 |
| `region` | VARCHAR(50) | | `national` \| 省份名 |
| `event_type` | VARCHAR(30) | | `war` \| `policy` \| `social` \| `economic` \| `disaster` |
| `description` | TEXT | | 事件描述 |
| `emotion_tone` | VARCHAR(20) | | `danger` \| `hope` \| `change` \| `loss` |
| `created_at` | TIMESTAMPTZ | | |

**预置数据**：约 15 条，覆盖 1904-2000 年重大历史事件。

---

### story_chapters（叙事章节表）

生成的故事章节（未充分使用）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → family_profiles | |
| `sequence_order` | INTEGER | | 章节顺序 |
| `beat_type` | VARCHAR(20) | | 叙事节拍类型 |
| `narration` | TEXT | | 叙事文本 |
| `pause_seconds` | INTEGER | DEFAULT 3 | 播放暂停时间 |
| `historical_event_id` | UUID | FK → historical_events | 关联历史事件 |
| `map_action` | JSONB | | 地图动作配置 |
| `person_id` | UUID | FK → persons | 关联人物 |
| `migration_id` | UUID | FK → migrations | 关联迁徙 |
| `created_at` | TIMESTAMPTZ | | |

---

### chat_sessions（对话会话表）

存储 Agent 对话历史，支持续谈。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → family_profiles | |
| `user_id` | UUID | FK → users | |
| `messages` | JSONB | DEFAULT '[]' | 对话历史数组 |
| `is_complete` | BOOLEAN | DEFAULT FALSE | 是否采集完成 |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | 触发器更新 |

**messages 格式**：
```json
[
  {"role": "user", "content": "我住在北京市朝阳区"},
  {"role": "assistant", "content": "好的，请问你的祖籍是哪里？"}
]
```

---

## 视图

### v_migration_paths

完整展示家族迁徙路径（含 JOIN 后数据）。

```sql
CREATE VIEW v_migration_paths AS
SELECT
  m.id,
  m.family_id,
  m.sequence_order,
  p.role AS person_role,
  p.name AS person_name,
  p.generation,
  fp.raw_name AS from_place,
  fp.longitude AS from_lng,
  fp.latitude AS from_lat,
  tp.raw_name AS to_place,
  tp.longitude AS to_lng,
  tp.latitude AS to_lat,
  m.year,
  m.reason,
  m.reason_type,
  m.emotion_weight
FROM migrations m
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp ON m.from_place_id = fp.id
LEFT JOIN places tp ON m.to_place_id = tp.id
ORDER BY m.family_id, m.sequence_order;
```

---

## 触发器

### update_updated_at

自动更新 `updated_at` 字段。

```sql
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用于：users, family_profiles, chat_sessions
```

---

## 数据完整性规则

### 必填字段检查

| 表 | 必填字段 |
|----|----------|
| `family_profiles` | `family_name` |
| `persons` | `family_id`, `role`, `generation` |
| `migrations` | `family_id`, `person_id`, `to_place_raw` |
| `places` | `raw_name` |

### 外键约束

- 删除家族 → 级联删除人物、迁徙、章节、会话
- 删除人物 → 级联删除迁徙
- 删除地点 → 限制（如有迁徙引用）

### 数据质量检查 SQL

```sql
-- 1. 缺少地点的迁徙
SELECT * FROM migrations
WHERE from_place_id IS NULL OR to_place_id IS NULL;

-- 2. 缺少坐标的地点
SELECT * FROM places
WHERE longitude IS NULL OR latitude IS NULL;

-- 3. 孤立人物（无迁徙）
SELECT * FROM persons
WHERE id NOT IN (SELECT DISTINCT person_id FROM migrations);

-- 4. 不完整家族（<2 人或 0 迁徙）
SELECT fp.id, fp.family_name,
       COUNT(DISTINCT p.id) AS persons,
       COUNT(DISTINCT m.id) AS migrations
FROM family_profiles fp
LEFT JOIN persons p ON fp.id = p.family_id
LEFT JOIN migrations m ON fp.id = m.family_id
GROUP BY fp.id, fp.family_name
HAVING COUNT(DISTINCT p.id) < 2 OR COUNT(DISTINCT m.id) = 0;
```

---

## 变更日志

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-04-08 | 1.0.0 | 初始版本，基于现有 schema.sql 整理 |
