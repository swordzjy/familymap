-- ============================================================
-- 叙事意图 Agent · 表结构扩展
-- ============================================================
-- 为 story_chapters 表添加情感标签和历史背景字段
-- 支持独立故事关联（story_id）
-- ============================================================

-- 1. 添加 emotion_tags 字段（JSONB 数组）
ALTER TABLE story_chapters
  ADD COLUMN IF NOT EXISTS emotion_tags JSONB;

-- 2. 添加 historical_context 字段（JSONB 对象）
ALTER TABLE story_chapters
  ADD COLUMN IF NOT EXISTS historical_context JSONB;

-- 3. 添加 story_id 字段（关联独立故事表）
-- 注意：stories 表如果不存在，需要先创建
ALTER TABLE story_chapters
  ADD COLUMN IF NOT EXISTS story_id UUID;

-- 4. 添加外键约束（如果 stories 表存在）
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stories') THEN
--     ALTER TABLE story_chapters
--       ADD CONSTRAINT fk_story_chapters_story
--       FOREIGN KEY (story_id) REFERENCES stories(id);
--   END IF;
-- END $$;

-- 5. 为新增字段添加注释
COMMENT ON COLUMN story_chapters.emotion_tags IS 'AI 生成的情绪标签数组，如 ["struggle", "hope", "loss"]';
COMMENT ON COLUMN story_chapters.historical_context IS 'AI 生成的历史背景对象，如 {"event_name": "抗日战争", "local_impact": "...", "emotion_tone": "danger"}';
COMMENT ON COLUMN story_chapters.story_id IS '关联独立故事表的 ID（可选，用于非迁徙类故事）';

-- 6. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_story_chapters_emotion_tags
  ON story_chapters USING GIN (emotion_tags);

-- ============================================================
-- 独立故事表（如果不存在则创建）
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID REFERENCES family_profiles(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES persons(id) ON DELETE CASCADE,
  title           VARCHAR(200),              -- 故事标题，如"祖父的童年"
  content         TEXT,                      -- 用户输入的原始内容
  year            INTEGER,                   -- 故事发生年份
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_family ON stories(family_id);
CREATE INDEX IF NOT EXISTS idx_stories_person ON stories(person_id);

COMMENT ON TABLE stories IS '独立故事表，用于存储不绑定迁徙的纯故事（如童年回忆、人物生平等）';
