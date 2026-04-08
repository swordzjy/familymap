-- ============================================================
-- 家族迁徙平台 · 数据健康检查与清理工具
-- 用途：检查数据完整性、清理孤儿数据、修复常见问题
-- 使用：psql -U postgres -d family_migration -f data-health.sql
-- ============================================================

-- ============================================================
-- 1. 数据健康检查
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
    WHEN fp_place.longitude IS NULL OR tp_place.longitude IS NULL THEN '坐标缺失'
    ELSE 'OK'
  END AS issue
FROM migrations m
JOIN family_profiles fp ON m.family_id = fp.id
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp_place ON m.from_place_id = fp_place.id
LEFT JOIN places tp_place ON m.to_place_id = tp_place.id
WHERE fp_place.id IS NULL OR tp_place.id IS NULL OR fp_place.longitude IS NULL OR tp_place.longitude IS NULL
ORDER BY fp.family_name, m.year;

\echo ''
\echo '=== 2. 家族数据完整性 ==='

SELECT
  fp.family_name,
  fp.status,
  COUNT(DISTINCT p.id) AS persons,
  COUNT(DISTINCT m.id) AS migrations,
  COUNT(DISTINCT cs.id) AS chat_sessions
FROM family_profiles fp
LEFT JOIN persons p ON fp.id = p.family_id
LEFT JOIN migrations m ON fp.id = m.family_id
LEFT JOIN chat_sessions cs ON fp.id = cs.family_id
GROUP BY fp.family_name, fp.status
ORDER BY fp.family_name;

\echo ''
\echo '=== 3. 孤儿数据检查 ==='

SELECT '孤儿人物（无迁徙记录）' AS type, COUNT(*) AS count
FROM persons p
WHERE NOT EXISTS (SELECT 1 FROM migrations m WHERE m.person_id = p.id)
UNION ALL
SELECT '孤儿地点（未被引用）', COUNT(*)
FROM places pla
WHERE NOT EXISTS (SELECT 1 FROM migrations m WHERE m.from_place_id = pla.id OR m.to_place_id = pla.id)
UNION ALL
SELECT '孤儿家族（无人物）', COUNT(*)
FROM family_profiles fp
WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.family_id = fp.id)
UNION ALL
SELECT '过期未完成会话', COUNT(*)
FROM chat_sessions cs
WHERE cs.is_complete = false AND cs.updated_at < NOW() - INTERVAL '24 hours';

\echo ''
\echo '=== 4. 表行数统计 ==='

SELECT 'family_profiles' AS table_name, COUNT(*) AS row_count FROM family_profiles
UNION ALL SELECT 'persons', COUNT(*) FROM persons
UNION ALL SELECT 'migrations', COUNT(*) FROM migrations
UNION ALL SELECT 'places', COUNT(*) FROM places
UNION ALL SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
UNION ALL SELECT 'historical_events', COUNT(*) FROM historical_events;

-- ============================================================
-- 2. 数据清理（可选执行）
-- ============================================================
-- 注意：执行前请备份数据！取消下面注释即可执行

-- \echo ''
-- \echo '=== 开始清理孤儿数据 ==='

-- -- 1. 删除孤儿人物
-- DELETE FROM persons
-- WHERE id NOT IN (SELECT DISTINCT person_id FROM migrations WHERE person_id IS NOT NULL);

-- -- 2. 删除孤儿地点
-- DELETE FROM places
-- WHERE id NOT IN (SELECT DISTINCT from_place_id FROM migrations WHERE from_place_id IS NOT NULL)
--   AND id NOT IN (SELECT DISTINCT to_place_id FROM migrations WHERE to_place_id IS NOT NULL);

-- -- 3. 删除孤儿家族
-- DELETE FROM family_profiles
-- WHERE id NOT IN (SELECT DISTINCT family_id FROM persons WHERE family_id IS NOT NULL)
--    OR id NOT IN (SELECT DISTINCT family_id FROM migrations WHERE family_id IS NOT NULL);

-- -- 4. 删除过期会话
-- DELETE FROM chat_sessions
-- WHERE is_complete = false AND updated_at < NOW() - INTERVAL '24 hours';

-- \echo '=== 清理完成 ==='

-- ============================================================
-- 3. 修复缺失坐标（示例）
-- ============================================================
-- 如果发现缺失坐标，可以手动添加：

-- INSERT INTO places (raw_name, normalized_name, province, city, longitude, latitude, country, geocode_source)
-- SELECT '铁岭市', '铁岭市', '辽宁省', '铁岭市', 123.8428, 42.2892, '中国', 'manual'
-- WHERE NOT EXISTS (SELECT 1 FROM places WHERE raw_name = '铁岭市');

-- INSERT INTO places (raw_name, normalized_name, province, city, longitude, latitude, country, geocode_source)
-- SELECT '双城市', '哈尔滨市双城区', '黑龙江省', '哈尔滨市', 126.2247, 45.3522, '中国', 'manual'
-- WHERE NOT EXISTS (SELECT 1 FROM places WHERE raw_name = '双城市');

-- 更新 migrations 关联
-- UPDATE migrations SET from_place_id = p.id FROM places p WHERE migrations.from_place_id IS NULL AND p.raw_name = migrations.from_place_raw;
-- UPDATE migrations SET to_place_id = p.id FROM places p WHERE migrations.to_place_id IS NULL AND p.raw_name = migrations.to_place_raw;
