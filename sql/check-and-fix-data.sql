-- ============================================================
-- 家族迁徙数据 · 检查与修复工具
-- ============================================================
-- 使用说明：
--   psql -U postgres -d family_migration -f check-and-fix-data.sql
-- ============================================================

-- ============================================================
-- 1. 检查：缺少坐标的迁徙记录
-- ============================================================
\echo ''
\echo '=== 1. 缺少坐标的迁徙记录 ==='

SELECT
  m.id,
  fp.family_name,
  p.name AS person_name,
  p.role AS person_role,
  m.from_place_raw,
  m.to_place_raw,
  m.year,
  CASE
    WHEN fp_place.id IS NULL THEN 'from_place 缺失'
    WHEN tp_place.id IS NULL THEN 'to_place 缺失'
    ELSE 'OK'
  END AS issue
FROM migrations m
JOIN family_profiles fp ON m.family_id = fp.id
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp_place ON m.from_place_id = fp_place.id
LEFT JOIN places tp_place ON m.to_place_id = tp_place.id
WHERE m.from_place_id IS NULL OR m.to_place_id IS NULL
   OR fp_place.id IS NULL OR tp_place.id IS NULL
ORDER BY m.year;

-- ============================================================
-- 2. 检查：孤立的迁徙记录（引用不存在的地点）
-- ============================================================
\echo ''
\echo '=== 2. 孤立的迁徙记录（引用不存在的地点 ID） ==='

SELECT
  m.id,
  m.from_place_id,
  m.to_place_id,
  m.from_place_raw,
  m.to_place_raw,
  'from_place 不存在' AS issue
FROM migrations m
WHERE m.from_place_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.id = m.from_place_id)
UNION ALL
SELECT
  m.id,
  m.from_place_id,
  m.to_place_id,
  m.from_place_raw,
  m.to_place_raw,
  'to_place 不存在' AS issue
FROM migrations m
WHERE m.to_place_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.id = m.to_place_id);

-- ============================================================
-- 3. 检查：孤立的地点（没有被任何迁徙引用）
-- ============================================================
\echo ''
\echo '=== 3. 孤立的地点（未被迁徙引用） ==='

SELECT
  p.id,
  p.raw_name,
  p.normalized_name,
  p.province,
  p.city,
  '无迁徙引用' AS status
FROM places p
WHERE p.id NOT IN (SELECT DISTINCT from_place_id FROM migrations WHERE from_place_id IS NOT NULL)
  AND p.id NOT IN (SELECT DISTINCT to_place_id FROM migrations WHERE to_place_id IS NOT NULL);

-- ============================================================
-- 4. 检查：不完整的人物记录（没有关联迁徙）
-- ============================================================
\echo ''
\echo '=== 4. 不完整的人物记录（没有关联迁徙） ==='

SELECT
  p.id,
  p.family_id,
  p.role,
  p.name,
  p.birth_year,
  p.birth_place,
  '无迁徙记录' AS status
FROM persons p
WHERE p.id NOT IN (SELECT DISTINCT person_id FROM migrations WHERE person_id IS NOT NULL);

-- ============================================================
-- 5. 检查：不完整的家族（没有足够的人物或迁徙）
-- ============================================================
\echo ''
\echo '=== 5. 不完整的家族 ==='

SELECT
  fp.id,
  fp.family_name,
  fp.status,
  COUNT(DISTINCT p.id) AS persons,
  COUNT(DISTINCT m.id) AS migrations,
  CASE
    WHEN COUNT(DISTINCT p.id) = 0 THEN '无人物'
    WHEN COUNT(DISTINCT m.id) = 0 THEN '无迁徙'
    WHEN COUNT(DISTINCT p.id) < 2 THEN '人物少于 2 人'
    ELSE 'OK'
  END AS status
FROM family_profiles fp
LEFT JOIN persons p ON fp.id = p.family_id
LEFT JOIN migrations m ON fp.id = m.family_id
GROUP BY fp.id, fp.family_name, fp.status
HAVING COUNT(DISTINCT p.id) < 2 OR COUNT(DISTINCT m.id) = 0
ORDER BY fp.created_at;

-- ============================================================
-- 6. 修复：为缺失地点的迁徙记录创建地点并更新引用
-- ============================================================
\echo ''
\echo '=== 6. 修复：补充缺失的地点数据 ==='

-- 创建一个临时函数来补充地点
CREATE OR REPLACE FUNCTION fix_missing_places()
RETURNS TABLE(fixed_count INTEGER, details TEXT) AS $$
DECLARE
  rec RECORD;
  v_place_id UUID;
  v_count INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- 处理 from_place 缺失的情况
  FOR rec IN
    SELECT DISTINCT m.from_place_raw, m.from_place_id
    FROM migrations m
    WHERE (m.from_place_id IS NULL OR m.from_place_id = '')
      AND m.from_place_raw IS NOT NULL
      AND m.from_place_raw != ''
  LOOP
    -- 检查是否已存在同名地点
    SELECT id INTO v_place_id FROM places WHERE raw_name = rec.from_place_raw LIMIT 1;

    IF v_place_id IS NULL THEN
      -- 创建新地点（坐标设为 NULL，需要后续地理编码）
      INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude, country)
      VALUES (uuid_generate_v4(), rec.from_place_raw, rec.from_place_raw, NULL, NULL, NULL, NULL, '中国')
      RETURNING id INTO v_place_id;

      -- 更新迁徙记录
      UPDATE migrations SET from_place_id = v_place_id WHERE from_place_raw = rec.from_place_raw AND from_place_id IS NULL;

      v_count := v_count + 1;
      v_details := v_details || 'from_place: ' || rec.from_place_raw || '; ';
    END IF;
  END LOOP;

  -- 处理 to_place 缺失的情况
  FOR rec IN
    SELECT DISTINCT m.to_place_raw, m.to_place_id
    FROM migrations m
    WHERE (m.to_place_id IS NULL OR m.to_place_id = '')
      AND m.to_place_raw IS NOT NULL
      AND m.to_place_raw != ''
  LOOP
    -- 检查是否已存在同名地点
    SELECT id INTO v_place_id FROM places WHERE raw_name = rec.to_place_raw LIMIT 1;

    IF v_place_id IS NULL THEN
      -- 创建新地点
      INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude, country)
      VALUES (uuid_generate_v4(), rec.to_place_raw, rec.to_place_raw, NULL, NULL, NULL, NULL, '中国')
      RETURNING id INTO v_place_id;

      -- 更新迁徙记录
      UPDATE migrations SET to_place_id = v_place_id WHERE to_place_raw = rec.to_place_raw AND to_place_id IS NULL;

      v_count := v_count + 1;
      v_details := v_details || 'to_place: ' || rec.to_place_raw || '; ';
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_count, v_details;
END;
$$ LANGUAGE plpgsql;

-- 执行修复
SELECT * FROM fix_missing_places();

-- 删除临时函数
DROP FUNCTION IF EXISTS fix_missing_places();

-- ============================================================
-- 7. 验证：修复后的状态
-- ============================================================
\echo ''
\echo '=== 7. 验证：修复后的状态 ==='

SELECT
  '迁徙记录总数' AS item,
  COUNT(*)::TEXT AS value
FROM migrations
UNION ALL
SELECT '缺少 from_place_id', COUNT(*)::TEXT
FROM migrations WHERE from_place_id IS NULL
UNION ALL
SELECT '缺少 to_place_id', COUNT(*)::TEXT
FROM migrations WHERE to_place_id IS NULL
UNION ALL
SELECT '地点总数', COUNT(*)::TEXT
FROM places
UNION ALL
SELECT '人物总数', COUNT(*)::TEXT
FROM persons
UNION ALL
SELECT '家族总数', COUNT(*)::TEXT
FROM family_profiles;

\echo ''
\echo '=== 数据检查完成 ==='
