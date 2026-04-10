-- ============================================================
-- 查询指定 familyId 的用户数据和坐标检查
-- 用法：psql -h localhost -U aifeisu -d family_migration -v fid="'<your-family-id>'" -f sql/check-family.sql
-- 或直接修改下面第一行
-- ============================================================

\set fid 'feb7d4e6-7891-4bb0-b8e9-670e965b665d'

-- ============================================================
-- 1. 家族档案基本信息
-- ============================================================
\echo '=== 家族档案 ==='
SELECT id, family_name, raw_input, input_mode, ai_confidence, status, created_at
FROM family_profiles
WHERE id = :'fid';

-- ============================================================
-- 2. 家族成员列表
-- ============================================================
\echo '=== 家族成员 ==='
SELECT internal_id, role, name, gender, generation, birth_year, birth_place, occupation
FROM persons
WHERE family_id = :'fid'
ORDER BY generation DESC, birth_year;

-- ============================================================
-- 3. 迁徙记录（含坐标检查）
-- ============================================================
\echo '=== 迁徙记录与坐标 ==='
SELECT
  m.id AS migration_id,
  m.sequence_order,
  p.internal_id,
  p.name AS person_name,
  m.year,
  m.reason,
  m.reason_type,
  -- 起点
  m.from_place_raw,
  fp.raw_name  AS from_place_cached_name,
  fp.longitude AS from_lng,
  fp.latitude  AS from_lat,
  CASE WHEN fp.longitude IS NULL OR fp.latitude IS NULL THEN '✗ 缺坐标' ELSE '✓' END AS from_coord_status,
  -- 终点
  m.to_place_raw,
  tp.raw_name  AS to_place_cached_name,
  tp.longitude AS to_lng,
  tp.latitude  AS to_lat,
  CASE WHEN tp.longitude IS NULL OR tp.latitude IS NULL THEN '✗ 缺坐标' ELSE '✓' END AS to_coord_status
FROM migrations m
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp ON m.from_place_id = fp.id
LEFT JOIN places tp ON m.to_place_id = tp.id
WHERE m.family_id = :'fid'
ORDER BY m.sequence_order;

-- ============================================================
-- 4. 地点缓存明细
-- ============================================================
\echo '=== 地点缓存明细 ==='
SELECT
  pl.id,
  pl.raw_name,
  pl.normalized_name,
  pl.province,
  pl.city,
  pl.longitude,
  pl.latitude,
  pl.geocode_source,
  pl.created_at,
  CASE WHEN pl.longitude IS NULL OR pl.latitude IS NULL THEN '✗ 缺坐标' ELSE '✓' END AS coord_status
FROM places pl
WHERE pl.id IN (
  SELECT m.from_place_id FROM migrations m WHERE m.family_id = :'fid'
  UNION
  SELECT m.to_place_id FROM migrations m WHERE m.family_id = :'fid'
);

-- ============================================================
-- 5. 坐标缺失统计
-- ============================================================
\echo '=== 坐标缺失统计 ==='
SELECT
  COUNT(*) AS total_migrations,
  COUNT(fp.id) AS from_place_cached,
  COUNT(fp.id) FILTER (WHERE fp.longitude IS NOT NULL AND fp.latitude IS NOT NULL) AS from_place_has_coords,
  COUNT(tp.id) AS to_place_cached,
  COUNT(tp.id) FILTER (WHERE tp.longitude IS NOT NULL AND tp.latitude IS NOT NULL) AS to_place_has_coords,
  COUNT(*) - COUNT(fp.id) AS from_place_uncached,
  COUNT(*) - COUNT(tp.id) AS to_place_uncached
FROM migrations m
LEFT JOIN places fp ON m.from_place_id = fp.id
LEFT JOIN places tp ON m.to_place_id = tp.id
WHERE m.family_id = :'fid';

-- ============================================================
-- 6. 需要重新地理编码的地名列表
-- ============================================================
\echo '=== 需要地理编码的地名 ==='
SELECT DISTINCT
  m.from_place_raw AS place_name,
  '起点' AS direction,
  CASE WHEN fp.id IS NULL THEN '未缓存' ELSE '坐标为空' END AS reason
FROM migrations m
LEFT JOIN places fp ON m.from_place_id = fp.id
WHERE m.family_id = :'fid'
  AND (fp.id IS NULL OR fp.longitude IS NULL)

UNION ALL

SELECT DISTINCT
  m.to_place_raw AS place_name,
  '终点' AS direction,
  CASE WHEN tp.id IS NULL THEN '未缓存' ELSE '坐标为空' END AS reason
FROM migrations m
LEFT JOIN places tp ON m.to_place_id = tp.id
WHERE m.family_id = :'fid'
  AND (tp.id IS NULL OR tp.longitude IS NULL)

ORDER BY place_name;

-- ============================================================
-- 7. 清除失败的地名缓存（方便重新 geocode）
-- 使用方法：取消注释后执行
-- ============================================================
-- \echo '=== 清除坐标为空的地名缓存 ==='
-- DELETE FROM places
-- WHERE id IN (
--   SELECT fp.id FROM migrations m
--   LEFT JOIN places fp ON m.from_place_id = fp.id
--   WHERE m.family_id = :'fid'
--     AND (fp.longitude IS NULL OR fp.latitude IS NULL)
--   UNION
--   SELECT tp.id FROM migrations m
--   LEFT JOIN places tp ON m.to_place_id = tp.id
--   WHERE m.family_id = :'fid'
--     AND (tp.longitude IS NULL OR tp.latitude IS NULL)
-- );
-- \echo '已清除，可重新触发地理编码'
