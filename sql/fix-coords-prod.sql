-- ============================================================
-- 家族迁徙平台 · 修复缺失坐标 (生产环境)
-- 用途：修复 "黑龙江双城" 等地点的缺失坐标
-- 使用：psql -U postgres -d family_migration -f fix-coords-prod.sql
-- ============================================================

-- 1. 检查当前缺失坐标的地点
SELECT DISTINCT
  COALESCE(fp.raw_name, m.from_place_raw) AS place_name,
  '起点' AS place_type
FROM migrations m
LEFT JOIN places fp ON m.from_place_id = fp.id
WHERE fp.longitude IS NULL OR fp.latitude IS NULL OR m.from_place_id IS NULL
UNION
SELECT DISTINCT
  COALESCE(tp.raw_name, m.to_place_raw) AS place_name,
  '终点' AS place_type
FROM migrations m
LEFT JOIN places tp ON m.to_place_id = tp.id
WHERE tp.longitude IS NULL OR tp.latitude IS NULL OR m.to_place_id IS NULL;

-- 2. 插入缺失的地点坐标（如果不存在）
-- 黑龙江双城（现哈尔滨市双城区）
INSERT INTO places (raw_name, normalized_name, province, city, longitude, latitude, country, geocode_source)
SELECT '黑龙江双城', '哈尔滨市双城区', '黑龙江省', '哈尔滨市', 126.2247, 45.3522, '中国', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE raw_name = '黑龙江双城');

-- 3. 更新 migrations 表，关联地点 ID
UPDATE migrations
SET from_place_id = p.id
FROM places p
WHERE migrations.from_place_id IS NULL
  AND p.raw_name = migrations.from_place_raw;

UPDATE migrations
SET to_place_id = p.id
FROM places p
WHERE migrations.to_place_id IS NULL
  AND p.raw_name = migrations.to_place_raw;

-- 4. 验证修复结果
SELECT
  fp.family_name AS "家族",
  m.sequence_order AS "顺序",
  COALESCE(fp_name.raw_name, m.from_place_raw) AS "起点",
  fp_coords.longitude AS "起点经度",
  fp_coords.latitude AS "起点纬度",
  COALESCE(tp_name.raw_name, m.to_place_raw) AS "终点",
  tp_coords.longitude AS "终点经度",
  tp_coords.latitude AS "终点纬度",
  CASE
    WHEN fp_coords.longitude IS NULL OR tp_coords.longitude IS NULL THEN '仍缺坐标'
    ELSE '已修复'
  END AS "状态"
FROM migrations m
JOIN family_profiles fp ON m.family_id = fp.id
LEFT JOIN places fp_name ON m.from_place_id = fp_name.id
LEFT JOIN places fp_coords ON m.from_place_id = fp_coords.id
LEFT JOIN places tp_name ON m.to_place_id = tp_name.id
LEFT JOIN places tp_coords ON m.to_place_id = tp_coords.id
ORDER BY fp.family_name, m.sequence_order;
