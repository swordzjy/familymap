-- ============================================================
-- 家族迁徙平台 · 数据库建库语句
-- PostgreSQL 14+
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 用于模糊地名搜索

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE,
  nickname      VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 家族档案表（一个用户可有多个家族档案）
-- ============================================================
CREATE TABLE family_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  family_name     VARCHAR(100),            -- 姓氏或家族名
  raw_input       TEXT,                    -- 用户原始叙述文本
  input_mode      VARCHAR(20) DEFAULT 'text', -- text | voice | mixed
  ai_confidence   DECIMAL(3,2),            -- AI解析置信度 0.00-1.00
  status          VARCHAR(20) DEFAULT 'processing', -- processing | ready | failed
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. 家族成员表（人物节点）
-- ============================================================
CREATE TABLE persons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id) ON DELETE CASCADE,
  internal_id     VARCHAR(10),             -- AI分配的临时ID如 p1,p2
  role            VARCHAR(50),             -- 爷爷/奶奶/父亲/母亲/本人
  name            VARCHAR(100) DEFAULT '未知',
  gender          VARCHAR(10),             -- male | female | unknown
  birth_year      INTEGER,
  death_year      INTEGER,                 -- NULL 表示在世或未知
  birth_place     VARCHAR(200),            -- 原始地名文本
  occupation      VARCHAR(100),
  generation      INTEGER,                 -- 相对用户代际：0=本人,1=父母,-1=子女
  notes           TEXT,                    -- 额外备注
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. 地点表（地理编码结果缓存）
-- ============================================================
CREATE TABLE places (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_name        VARCHAR(200) NOT NULL,   -- 原始地名
  normalized_name VARCHAR(200),            -- 标准化地名
  province        VARCHAR(50),
  city            VARCHAR(50),
  district        VARCHAR(50),
  longitude       DECIMAL(10,7),           -- 高德返回经度
  latitude        DECIMAL(10,7),           -- 高德返回纬度
  country         VARCHAR(50) DEFAULT '中国',
  geocode_source  VARCHAR(20) DEFAULT 'amap', -- amap | google | manual
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_name)                         -- 相同地名不重复查询
);

CREATE INDEX idx_places_raw_name ON places USING GIN (raw_name gin_trgm_ops);

-- ============================================================
-- 5. 迁徙事件表（核心数据）
-- ============================================================
CREATE TABLE migrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES persons(id) ON DELETE CASCADE,
  from_place_id   UUID REFERENCES places(id),
  to_place_id     UUID REFERENCES places(id),
  from_place_raw  VARCHAR(200),            -- 保留原始文本
  to_place_raw    VARCHAR(200),
  year            INTEGER,                 -- 迁徙年份
  year_approx     BOOLEAN DEFAULT FALSE,   -- 是否是估计年份
  reason          TEXT,                    -- 迁徙原因
  reason_type     VARCHAR(30),             -- study|work|war|disaster|assignment|family|unknown
  emotion_weight  VARCHAR(10) DEFAULT 'medium', -- low|medium|high
  sequence_order  INTEGER,                 -- 在家族迁徙序列中的顺序
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_migrations_family ON migrations(family_id);
CREATE INDEX idx_migrations_person ON migrations(person_id);

-- ============================================================
-- 6. 家族关系表
-- ============================================================
CREATE TABLE relationships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id) ON DELETE CASCADE,
  from_person_id  UUID REFERENCES persons(id),
  to_person_id    UUID REFERENCES persons(id),
  relation_type   VARCHAR(30),             -- 父子|母女|夫妻|祖孙|兄弟|姐妹
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. 历史事件库（预置数据）
-- ============================================================
CREATE TABLE historical_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  year_start      INTEGER,
  year_end        INTEGER,
  region          VARCHAR(50),             -- national|东北|华北|华东|华南|西南|西北
  event_type      VARCHAR(30),             -- war|disaster|policy|social|economic
  description     TEXT,
  emotion_tone    VARCHAR(20),             -- danger|hope|change|loss|triumph
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 预置中国近现代核心历史事件
INSERT INTO historical_events (name, year_start, year_end, region, event_type, emotion_tone, description) VALUES
('日俄战争', 1904, 1905, '东北', 'war', 'danger', '日俄两国在中国东北爆发战争，波及黑龙江、辽宁等地'),
('辛亥革命', 1911, 1912, 'national', 'social', 'change', '清朝覆灭，中华民国成立，社会结构剧变'),
('五四运动', 1919, 1919, 'national', 'social', 'hope', '新文化运动高潮，知识分子觉醒'),
('军阀混战', 1916, 1928, 'national', 'war', 'danger', '北洋军阀割据，民不聊生'),
('九一八事变', 1931, 1931, '东北', 'war', 'loss', '日本侵占东北三省，东北沦陷'),
('抗日战争', 1937, 1945, 'national', 'war', 'danger', '全面抗战，举国动荡'),
('长沙大火', 1938, 1938, '华南', 'disaster', 'loss', '文夕大火，长沙被毁'),
('解放战争', 1945, 1949, 'national', 'war', 'change', '国共内战，山河易主'),
('土地改革', 1950, 1953, 'national', 'policy', 'change', '农村土地重分，贫农获地'),
('抗美援朝', 1950, 1953, 'national', 'war', 'danger', '朝鲜战争，大批青年参军'),
('大跃进', 1958, 1962, 'national', 'policy', 'danger', '大规模运动，粮食危机'),
('三年困难时期', 1959, 1961, 'national', 'disaster', 'danger', '大饥荒，农村极度困难'),
('文化大革命', 1966, 1976, 'national', 'policy', 'danger', '十年动乱，知识分子受冲击'),
('上山下乡运动', 1968, 1980, 'national', 'policy', 'loss', '知青下乡，城市青年被分配农村'),
('恢复高考', 1977, 1977, 'national', 'policy', 'hope', '高考恢复，知识改变命运重新成为可能'),
('改革开放', 1978, 2000, 'national', 'economic', 'hope', '对外开放，经济腾飞，大量人口向城市流动');

-- ============================================================
-- 8. 叙事章节表（LLM生成的故事内容）
-- ============================================================
CREATE TABLE story_chapters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id) ON DELETE CASCADE,
  sequence_order  INTEGER,
  beat_type       VARCHAR(20),             -- anchor|person|danger|meeting|choice|arrival|silence
  narration       TEXT,                    -- 叙事文本
  pause_seconds   INTEGER DEFAULT 3,       -- 停顿时长
  historical_event_id UUID REFERENCES historical_events(id),
  map_action      JSONB,                   -- 地图动作描述
  person_id       UUID REFERENCES persons(id),
  migration_id    UUID REFERENCES migrations(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. 对话会话表（保存采集过程）
-- ============================================================
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id),
  user_id         UUID REFERENCES users(id),
  messages        JSONB DEFAULT '[]',      -- 完整对话历史
  is_complete     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 辅助函数：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_family_profiles_updated_at
  BEFORE UPDATE ON family_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 视图：完整的家族迁徙路径（供前端查询）
-- ============================================================
CREATE VIEW v_migration_paths AS
SELECT
  m.id,
  m.family_id,
  m.sequence_order,
  p.role        AS person_role,
  p.name        AS person_name,
  p.generation,
  fp.raw_name   AS from_place,
  fp.longitude  AS from_lng,
  fp.latitude   AS from_lat,
  tp.raw_name   AS to_place,
  tp.longitude  AS to_lng,
  tp.latitude   AS to_lat,
  m.year,
  m.reason,
  m.reason_type,
  m.emotion_weight
FROM migrations m
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp ON m.from_place_id = fp.id
LEFT JOIN places tp ON m.to_place_id = tp.id
ORDER BY m.family_id, m.sequence_order;
