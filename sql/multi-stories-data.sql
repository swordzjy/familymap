-- ============================================================
-- 多家族迁徙故事演示数据
-- 用于 multi-stories.html 页面演示
-- ============================================================
-- 使用方法：
--   psql -U postgres -d family_migration -f multi-stories-data.sql
-- ============================================================

-- ============================================================
-- 故事 1: 林家 - 闯关东 (1890-1895)
-- ============================================================

-- 家族档案
INSERT INTO family_profiles (id, family_name, raw_input, status, ai_confidence)
VALUES ('550e8400-e29b-41d4-a716-446655440001', '林家', '山东登州府黄县，闯关东', 'ready', 0.92)
ON CONFLICT (id) DO UPDATE SET status = 'ready';

-- 地点数据（使用 raw_name 唯一约束，插入或忽略）
INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude)
VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '黄县', '山东省烟台市黄县', '山东', '烟台', 120.523, 37.640),
  ('660e8400-e29b-41d4-a716-446655440002', '营口', '辽宁省营口市', '辽宁', '营口', 122.235, 40.667),
  ('660e8400-e29b-41d4-a716-446655440003', '哈尔滨', '黑龙江省哈尔滨市', '黑龙江', '哈尔滨', 126.535, 45.803)
ON CONFLICT (raw_name) DO NOTHING;

-- 人物数据
INSERT INTO persons (id, family_id, internal_id, role, name, gender, birth_year, death_year, birth_place, generation, notes)
VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'p1', '祖父', '林德福', 'male', 1875, 1942, '山东登州府黄县', 1, '带着全家闯关东'),
  ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'p2', '父亲', '林永福', 'male', 1905, 1978, '山东登州府黄县', 2, '10 岁随父闯关东'),
  ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'p3', '本人', '林建国', 'male', 1935, 2010, '哈尔滨', 3, '在哈尔滨出生成长')
ON CONFLICT (id) DO NOTHING;

-- 获取地点 ID（处理已存在情况）
DO $$
DECLARE
  v_from_place uuid;
  v_to_place uuid;
BEGIN
  -- 迁徙 1: 黄县 -> 营口
  SELECT id INTO v_from_place FROM places WHERE raw_name = '黄县' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '营口' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001',
          v_from_place, v_to_place, '黄县', '营口', 1890, '闯关东逃荒', 'survival', 'high', 1)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 1;

  -- 迁徙 2: 营口 -> 哈尔滨
  SELECT id INTO v_from_place FROM places WHERE raw_name = '营口' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '哈尔滨' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001',
          v_from_place, v_to_place, '营口', '哈尔滨', 1895, '北上垦荒', 'survival', 'high', 2)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 2;
END $$;

-- ============================================================
-- 故事 2: 陈家 - 抗战西迁 (1937-1946)
-- ============================================================

-- 家族档案
INSERT INTO family_profiles (id, family_name, raw_input, status, ai_confidence)
VALUES ('550e8400-e29b-41d4-a716-446655440002', '陈家', '南京，抗战西迁重庆，中央大学', 'ready', 0.89)
ON CONFLICT (id) DO UPDATE SET status = 'ready';

-- 地点数据
INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude)
VALUES
  ('660e8400-e29b-41d4-a716-446655440004', '南京', '江苏省南京市', '江苏', '南京', 118.796, 32.060),
  ('660e8400-e29b-41d4-a716-446655440005', '武汉', '湖北省武汉市', '湖北', '武汉', 114.305, 30.593),
  ('660e8400-e29b-41d4-a716-446655440006', '重庆', '重庆市', '重庆', '重庆', 106.551, 29.563)
ON CONFLICT (raw_name) DO NOTHING;

-- 人物数据
INSERT INTO persons (id, family_id, internal_id, role, name, gender, birth_year, death_year, birth_place, generation, notes)
VALUES
  ('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'p1', '祖父', '陈文渊', 'male', 1902, 1985, '南京', 1, '中央大学教授'),
  ('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 'p2', '父亲', '陈思源', 'male', 1928, 2005, '南京', 2, '随校西迁，就读西南联大'),
  ('770e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002', 'p3', '姑母', '陈婉如', 'female', 1930, 2018, '南京', 2, '战时参加抗日宣传')
ON CONFLICT (id) DO NOTHING;

-- 迁徙事件
DO $$
DECLARE
  v_from_place uuid;
  v_to_place uuid;
BEGIN
  -- 迁徙 1: 南京 -> 武汉
  SELECT id INTO v_from_place FROM places WHERE raw_name = '南京' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '武汉' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440004',
          v_from_place, v_to_place, '南京', '武汉', 1937, '抗战爆发举家西迁', 'war', 'high', 1)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 1;

  -- 迁徙 2: 武汉 -> 重庆
  SELECT id INTO v_from_place FROM places WHERE raw_name = '武汉' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '重庆' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440004',
          v_from_place, v_to_place, '武汉', '重庆', 1938, '再迁重庆避难', 'war', 'high', 2)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 2;

  -- 迁徙 3: 重庆 -> 南京
  SELECT id INTO v_from_place FROM places WHERE raw_name = '重庆' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '南京' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440004',
          v_from_place, v_to_place, '重庆', '南京', 1946, '抗战胜利还乡', 'hope', 'medium', 3)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 3;
END $$;

-- ============================================================
-- 故事 3: 赵家 - 三线建设 (1964-1982)
-- ============================================================

-- 家族档案
INSERT INTO family_profiles (id, family_name, raw_input, status, ai_confidence)
VALUES ('550e8400-e29b-41d4-a716-446655440003', '赵家', '上海，三线建设，兰州石化', 'ready', 0.91)
ON CONFLICT (id) DO UPDATE SET status = 'ready';

-- 地点数据
INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude)
VALUES
  ('660e8400-e29b-41d4-a716-446655440007', '上海', '上海市', '上海', '上海', 121.473, 31.231),
  ('660e8400-e29b-41d4-a716-446655440008', '兰州', '甘肃省兰州市', '甘肃', '兰州', 103.834, 36.061),
  ('660e8400-e29b-41d4-a716-446655440009', '西安', '陕西省西安市', '陕西', '西安', 108.940, 34.341)
ON CONFLICT (raw_name) DO NOTHING;

-- 人物数据
INSERT INTO persons (id, family_id, internal_id, role, name, gender, birth_year, death_year, birth_place, generation, notes)
VALUES
  ('770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'p1', '祖父', '赵志刚', 'male', 1932, 2001, '上海', 1, '上海石化厂工程师'),
  ('770e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440003', 'p2', '祖母', '王秀英', 'female', 1935, 2012, '上海', 1, '随夫支援西北'),
  ('770e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440003', 'p3', '父亲', '赵建华', 'male', 1958, 2020, '兰州', 2, '在兰州出生，后回上海'),
  ('770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440003', 'p4', '姑母', '赵建红', 'female', 1962, null, '兰州', 2, '留在兰州工作')
ON CONFLICT (id) DO NOTHING;

-- 迁徙事件
DO $$
DECLARE
  v_from_place uuid;
  v_to_place uuid;
BEGIN
  -- 迁徙 1: 上海 -> 兰州
  SELECT id INTO v_from_place FROM places WHERE raw_name = '上海' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '兰州' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440007',
          v_from_place, v_to_place, '上海', '兰州', 1964, '响应号召支援三线', 'policy', 'high', 1)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 1;

  -- 迁徙 2: 兰州 -> 西安
  SELECT id INTO v_from_place FROM places WHERE raw_name = '兰州' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '西安' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440009',
          v_from_place, v_to_place, '兰州', '西安', 1978, '考入西安交大', 'study', 'medium', 2)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 2;

  -- 迁徙 3: 西安 -> 上海
  SELECT id INTO v_from_place FROM places WHERE raw_name = '西安' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '上海' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440009',
          v_from_place, v_to_place, '西安', '上海', 1982, '大学毕业回沪工作', 'work', 'medium', 3)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 3;
END $$;

-- ============================================================
-- 故事 4: 周家 - 改革开放南下 (1985-2010)
-- ============================================================

-- 家族档案
INSERT INTO family_profiles (id, family_name, raw_input, status, ai_confidence)
VALUES ('550e8400-e29b-41d4-a716-446655440004', '周家', '沈阳，深圳打工创业，改革开放', 'ready', 0.88)
ON CONFLICT (id) DO UPDATE SET status = 'ready';

-- 地点数据
INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude)
VALUES
  ('660e8400-e29b-41d4-a716-446655440010', '沈阳', '辽宁省沈阳市', '辽宁', '沈阳', 123.431, 41.805),
  ('660e8400-e29b-41d4-a716-446655440011', '深圳', '广东省深圳市', '广东', '深圳', 114.057, 22.543),
  ('660e8400-e29b-41d4-a716-446655440012', '广州', '广东省广州市', '广东', '广州', 113.264, 23.129)
ON CONFLICT (raw_name) DO NOTHING;

-- 人物数据
INSERT INTO persons (id, family_id, internal_id, role, name, gender, birth_year, death_year, birth_place, generation, notes)
VALUES
  ('770e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', 'p1', '本人', '周志强', 'male', 1965, null, '沈阳', 1, '国企下岗后南下'),
  ('770e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440004', 'p2', '妻子', '李梅', 'female', 1968, null, '沈阳', 1, '随夫南下深圳'),
  ('770e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440004', 'p3', '儿子', '周天宇', 'male', 1990, null, '深圳', 2, '在深圳出生成长，出国留学')
ON CONFLICT (id) DO NOTHING;

-- 迁徙事件
DO $$
DECLARE
  v_from_place uuid;
  v_to_place uuid;
BEGIN
  -- 迁徙 1: 沈阳 -> 深圳
  SELECT id INTO v_from_place FROM places WHERE raw_name = '沈阳' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '深圳' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440011',
          v_from_place, v_to_place, '沈阳', '深圳', 1985, '南下打工创业', 'work', 'high', 1)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 1;

  -- 迁徙 2: 沈阳 -> 深圳
  SELECT id INTO v_from_place FROM places WHERE raw_name = '沈阳' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '深圳' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440012',
          v_from_place, v_to_place, '沈阳', '深圳', 1987, '夫妻团聚', 'family', 'medium', 2)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 2;

  -- 迁徙 3: 深圳 -> 广州
  SELECT id INTO v_from_place FROM places WHERE raw_name = '深圳' LIMIT 1;
  SELECT id INTO v_to_place FROM places WHERE raw_name = '广州' LIMIT 1;

  INSERT INTO migrations (id, family_id, person_id, from_place_id, to_place_id, from_place_raw, to_place_raw, year, reason, reason_type, emotion_weight, sequence_order)
  VALUES ('880e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440013',
          v_from_place, v_to_place, '深圳', '广州', 2010, '工作调动', 'work', 'low', 3)
  ON CONFLICT (id) DO UPDATE SET sequence_order = 3;
END $$;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '演示数据插入完成！共 4 个家族故事。' AS status;
