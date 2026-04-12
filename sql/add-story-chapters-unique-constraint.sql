-- ============================================================
-- 修复 story_chapters 表缺少唯一约束问题
-- 用于支持 ON CONFLICT (family_id, sequence_order) UPSERT 操作
-- ============================================================

-- 添加唯一约束
ALTER TABLE story_chapters
  ADD CONSTRAINT uk_story_chapters_family_sequence
  UNIQUE (family_id, sequence_order);

-- 验证约束已添加
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'story_chapters' AND constraint_name = 'uk_story_chapters_family_sequence';
