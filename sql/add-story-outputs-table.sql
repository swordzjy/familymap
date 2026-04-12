-- ============================================================
-- 新增 story_outputs 表：存储完整故事输出
-- 用于支持「完整故事」视图，AI 基于所有章节创作连贯叙事
-- ============================================================

-- 创建表
CREATE TABLE IF NOT EXISTS story_outputs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL,
  family_name     VARCHAR(50),

  version         INTEGER NOT NULL DEFAULT 1,
  output_type     VARCHAR(20) NOT NULL,       -- 'full_story' | 'chapter_list'

  -- 完整故事内容
  title           VARCHAR(200),
  prose           TEXT,                       -- 完整散文体故事

  -- 章节结构（用于快速定位）
  chapter_index   JSONB,                      -- [{ id, sequence, title, start_pos, end_pos }]

  -- 元数据
  source_chapters UUID[],                     -- 关联的原始章节 ID 列表
  word_count      INTEGER,
  duration_sec    INTEGER,

  -- 额外字段：整合的多人章节组
  merged_groups   JSONB,                      -- [{ new_sequence, merged_from, participants }]

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      VARCHAR(50) DEFAULT 'ai'
);

-- 唯一约束：每个家族的每个版本只有一条记录
ALTER TABLE story_outputs
  ADD CONSTRAINT uk_story_outputs_family_version
  UNIQUE (family_id, version);

-- 索引
CREATE INDEX IF NOT EXISTS idx_story_outputs_family ON story_outputs(family_id);
CREATE INDEX IF NOT EXISTS idx_story_outputs_type ON story_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_story_outputs_created ON story_outputs(created_at DESC);

-- 注释
COMMENT ON TABLE story_outputs IS '存储完整故事输出，支持多版本并存';
COMMENT ON COLUMN story_outputs.output_type IS '输出类型：full_story=完整故事，chapter_list=章节列表';
COMMENT ON COLUMN story_outputs.prose IS '完整散文体故事文本';
COMMENT ON COLUMN story_outputs.chapter_index IS '章节索引，用于快速定位和导航';
COMMENT ON COLUMN story_outputs.merged_groups IS '多人章节整合记录，记录哪些原始章节被合并';

-- 验证表已创建
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'story_outputs'
-- ORDER BY ordinal_position;
