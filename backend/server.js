// ============================================================
// 家族迁徙平台 · 后端 API  [Agent 版]
// ============================================================

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const axios   = require('axios');
require('dotenv').config();

// ============================================================
// 彩色日志工具（不需要额外依赖）
// ============================================================
const C = {
  reset:  '\x1b[0m',
  gray:   '\x1b[90m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  bold:   '\x1b[1m',
};

function ts() {
  return C.gray + new Date().toTimeString().slice(0, 8) + C.reset;
}

const log = {
  info:    (...a) => console.log(ts(), C.cyan  + '[INFO]'  + C.reset, ...a),
  ok:      (...a) => console.log(ts(), C.green + '[OK]'    + C.reset, ...a),
  warn:    (...a) => console.log(ts(), C.yellow+ '[WARN]'  + C.reset, ...a),
  error:   (...a) => console.error(ts(), C.red + '[ERROR]' + C.reset, ...a),
  db:      (...a) => console.log(ts(), C.blue  + '[DB]'    + C.reset, ...a),
  ai:      (...a) => console.log(ts(), C.blue  + '[AI]'    + C.reset, ...a),
  req:     (...a) => console.log(ts(), C.bold  + '[REQ]'   + C.reset, ...a),
  stream:  (...a) => process.stdout.write(C.gray + a.join('') + C.reset),
};

// ============================================================
// Express 初始化
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend/public'));

// 全局请求日志中间件
app.use((req, _res, next) => {
  log.req(`${req.method} ${req.path}`, req.body ? JSON.stringify(req.body).slice(0, 120) : '');
  next();
});

// ============================================================
// 数据库连接 + 启动验证
// ============================================================
const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'family_migration',
  user:     process.env.DB_USER     || 'aifeisu',
  password: process.env.DB_PASSWORD || 'afei123',
});

db.on('error', (err) => {
  log.error('PostgreSQL 连接池异常:', err.message);
});

async function checkDB() {
  try {
    const r = await db.query('SELECT NOW() as now, current_database() as db');
    log.ok(`数据库连接成功 → ${r.rows[0].db}  时间: ${r.rows[0].now}`);

    // 验证核心表是否存在
    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const names = tables.rows.map(r => r.table_name);
    log.db('已有表:', names.join(', '));

    const required = ['family_profiles', 'persons', 'migrations', 'places',
                      'historical_events', 'story_chapters'];
    const missing = required.filter(t => !names.includes(t));
    if (missing.length > 0) {
      log.warn('⚠ 缺少表:', missing.join(', '), '→ 请执行 sql/schema.sql');
    } else {
      log.ok('所有必需表已就绪');
    }

    // 验证历史事件预置数据
    const evtCount = await db.query('SELECT COUNT(*) FROM historical_events');
    log.db(`历史事件预置数据: ${evtCount.rows[0].count} 条`);

  } catch (err) {
    log.error('数据库连接失败:', err.message);
    log.error('请检查 .env 中的 DB_HOST / DB_NAME / DB_USER / DB_PASSWORD');
  }
}

// ============================================================
// AI 客户端（阿里云 DashScope 兼容 Anthropic SDK）
// ============================================================
const anthropic = new Anthropic({
  apiKey:  process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

// 启动时验证 AI 配置
function checkAI() {
  const key = process.env.DASHSCOPE_API_KEY;
  const url = process.env.ANTHROPIC_BASE_URL;
  if (!key) {
    log.warn('⚠ DASHSCOPE_API_KEY 未设置');
  } else {
    log.ok(`AI Key: ${key.slice(0, 8)}...${key.slice(-4)}`);
  }
  log.ok(`AI BaseURL: ${url || '(未设置，使用 Anthropic 默认)'}`);
}

// 统一模型名
const QWEN_MODEL       = process.env.QWEN_MODEL       || 'qwen3.5-plus';
const QWEN_MODEL_HEAVY = process.env.QWEN_MODEL_HEAVY || 'qwen-max';

// ============================================================
// 高德地图
// ============================================================
const { AmapClient } = require('./amap');
const amapClient = new AmapClient(
  process.env.AMAP_KEY,
  process.env.AMAP_JSCODE
);

function checkAmap() {
  if (!process.env.AMAP_KEY) {
    log.warn('⚠ AMAP_KEY 未设置，地理编码将使用 FALLBACK_COORDS');
  } else {
    log.ok(`高德 Key: ${process.env.AMAP_KEY.slice(0, 6)}...`);
  }
}

// ============================================================
// 工具函数
// ============================================================

const FALLBACK_COORDS = {
  // 黑龙江
  '黑龙江省双城县':   { longitude: 126.312, latitude: 45.374, normalized_name: '黑龙江省哈尔滨市双城区' },
  '双城县':          { longitude: 126.312, latitude: 45.374, normalized_name: '黑龙江省哈尔滨市双城区' },
  '双城':            { longitude: 126.312, latitude: 45.374, normalized_name: '黑龙江省哈尔滨市双城区' },
  '黑龙江双城':      { longitude: 126.312, latitude: 45.374, normalized_name: '黑龙江省哈尔滨市双城区' },
  '哈尔滨':          { longitude: 126.642, latitude: 45.757, normalized_name: '黑龙江省哈尔滨市' },
  '黑龙江省哈尔滨':  { longitude: 126.642, latitude: 45.757, normalized_name: '黑龙江省哈尔滨市' },
  // 北京
  '北京':            { longitude: 116.407, latitude: 39.904, normalized_name: '北京市' },
  '北京市':          { longitude: 116.407, latitude: 39.904, normalized_name: '北京市' },
  // 辽宁
  '辽宁省铁岭县':    { longitude: 123.844, latitude: 42.223, normalized_name: '辽宁省铁岭市' },
  '铁岭县':          { longitude: 123.844, latitude: 42.223, normalized_name: '辽宁省铁岭市' },
  '铁岭':            { longitude: 123.844, latitude: 42.223, normalized_name: '辽宁省铁岭市' },
  '辽宁省铁岭市':    { longitude: 123.844, latitude: 42.223, normalized_name: '辽宁省铁岭市' },
};

// 从地名中提取城市信息（用于高德 API city 参数，提高匹配准确性）
function extractCityFromPlace(placeName) {
  if (!placeName) return '';
  // 匹配省级行政区 + 城市名，如 "黑龙江省双城" → "黑龙江省"
  const provinceMatch = placeName.match(/^(广东省 | 广西省 | 四川省 | 贵州省 | 云南省 | 陕西省 | 甘肃省 | 青海省 | 湖南省 | 湖北省 | 河北省 | 河南省 | 山东省 | 山西省 | 江苏省 | 浙江省 | 安徽省 | 福建省 | 江西省 | 黑龙江省 | 吉林省 | 辽宁省)(.*)$/);
  if (provinceMatch) return provinceMatch[1];
  // 匹配城市名，如 "哈尔滨市双城" → "哈尔滨市"
  const cityMatch = placeName.match(/^(北京市 | 天津市 | 上海市 | 重庆市 | 哈尔滨市 | 长春市 | 沈阳市 | 大连市 | 石家庄市 | 太原市 | 济南市 | 青岛市 | 南京市 | 杭州市 | 合肥市 | 福州市 | 南昌市 | 郑州市 | 武汉市 | 长沙市 | 广州市 | 深圳市 | 南宁市 | 海口市 | 成都市 | 贵阳市 | 昆明市 | 西安市 | 兰州市 | 西宁市)(.*)$/);
  if (cityMatch) return cityMatch[1];
  return '';
}

async function geocodePlace(placeName) {
  if (!placeName) return null;

  // 1. 数据库缓存
  try {
    const cached = await db.query(
      'SELECT longitude, latitude, normalized_name FROM places WHERE raw_name = $1',
      [placeName]
    );
    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      if (row.longitude && row.latitude) {
        log.db(`地名缓存命中：${placeName} → ${row.longitude}, ${row.latitude}`);
        return row;
      }
      log.warn(`地名缓存命中但坐标为空：${placeName}，尝试重新获取`);
    }
  } catch (dbErr) {
    log.warn(`地名缓存查询失败 (${placeName}):`, dbErr.message);
  }

  // 2. 高德 API（尝试提取城市信息以提高准确性）
  const city = extractCityFromPlace(placeName);
  if (city) {
    log.info(`调用高德地理编码："${placeName}" city="${city}"`);
  } else {
    log.info(`调用高德地理编码："${placeName}"`);
  }
  const geo = await amapClient.geocode(placeName, city);

  if (!geo) {
    // 先精确匹配 fallback
    const fallback = FALLBACK_COORDS[placeName];
    if (fallback) {
      log.warn(`高德失败，使用 FALLBACK (精确): ${placeName} → ${fallback.longitude}, ${fallback.latitude}`);
      return fallback;
    }
    // 模糊匹配 fallback（包含匹配）
    for (const [name, coords] of Object.entries(FALLBACK_COORDS)) {
      if (placeName.includes(name) || name.includes(placeName)) {
        log.warn(`高德失败，使用 FALLBACK (模糊): ${placeName} ≈ ${name} → ${coords.longitude}, ${coords.latitude}`);
        return { ...coords };
      }
    }
    log.error(`地理编码完全失败： "${placeName}"`);
    return null;
  }

  log.ok(`地理编码成功: ${placeName} → ${geo.lng}, ${geo.lat} (${geo.formatted})`);

  // 3. 写入缓存
  try {
    await db.query(
      `INSERT INTO places
         (raw_name, normalized_name, province, city, longitude, latitude, geocode_source)
       VALUES ($1, $2, $3, $4, $5, $6, 'amap')
       ON CONFLICT (raw_name) DO UPDATE SET
         longitude = EXCLUDED.longitude,
         latitude = EXCLUDED.latitude,
         normalized_name = EXCLUDED.normalized_name,
         province = EXCLUDED.province,
         city = EXCLUDED.city,
         geocode_source = EXCLUDED.geocode_source`,
      [placeName, geo.formatted, geo.province, geo.city, geo.lng, geo.lat]
    );
    log.db(`地名缓存已更新：${placeName}`);
  } catch (dbErr) {
    log.warn(`地名写入缓存失败 (${placeName}):`, dbErr.message);
  }

  return { longitude: geo.lng, latitude: geo.lat, normalized_name: geo.formatted };
}

async function matchHistoricalEvents(year, region = 'national') {
  try {
    const result = await db.query(
      `SELECT name, year_start, year_end, description, emotion_tone
       FROM historical_events
       WHERE year_start <= $1 AND year_end >= $1
         AND (region = $2 OR region = 'national')
       ORDER BY emotion_tone DESC LIMIT 2`,
      [year, region]
    );
    if (result.rows.length > 0) {
      log.db(`历史事件匹配 year=${year}: ${result.rows.map(r => r.name).join(', ')}`);
    }
    return result.rows;
  } catch (err) {
    log.warn('历史事件查询失败:', err.message);
    return [];
  }
}

// ============================================================
// 路由：POST /amapapi/chat  流式对话（保留兼容）
// ============================================================
app.post('/amapapi/chat', async (req, res) => {
  const { messages, familyId } = req.body;
  const startTime = Date.now();  // 修复：补充 startTime 声明

  log.ai(`[chat] 开始  轮次=${messages?.length || 0}  familyId=${familyId || '无'}`);
  log.ai(`[chat] 模型=${QWEN_MODEL}  最后消息: "${messages?.at(-1)?.content?.slice(0, 60) || ''}"`);

  const COLLECTOR_SYSTEM = `你是家族故事收集者。通过对话收集迁徙信息。

规则：
1. 每次只问 1 个问题
2. 按顺序问：本人→父母→祖父母
3. 收集：地点、年份、原因
4. 语气温暖自然
5. 收集到 3 代后，末尾加 [INFO_COMPLETE]`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  let chunkCount = 0;

  try {
    log.ai('[chat] 发起 stream 请求...');

    const stream = anthropic.messages.stream({
      model:      QWEN_MODEL,
      max_tokens: 500,
      system:     COLLECTOR_SYSTEM,
      messages:   messages,
    });

    stream.on('text', (text) => {
      fullText   += text;
      chunkCount += 1;
      if (chunkCount % 5 === 1) {
        log.stream(` ·[stream chunk #${chunkCount}] "${text.slice(0, 30)}"`);
        process.stdout.write('\n');
      }
      res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    });

    stream.on('finalMessage', async (msg) => {
      const elapsed = Date.now() - startTime;
      const isComplete = fullText.includes('[INFO_COMPLETE]');
      log.ai(`[chat] 完成  耗时=${elapsed}ms  chunks=${chunkCount}  tokens=${msg.usage?.output_tokens || '?'}  isComplete=${isComplete}`);
      log.ai(`[chat] 完整回复(前100字): "${fullText.slice(0, 100)}"`);

      res.write(`data: ${JSON.stringify({ type: 'done', isComplete, familyId })}\n\n`);
      res.end();

      if (familyId) {
        db.query(
          `UPDATE chat_sessions SET messages=$1, is_complete=$2, updated_at=NOW()
           WHERE family_id=$3`,
          [JSON.stringify(messages), isComplete, familyId]
        ).then(() => {
          log.db(`[chat] 会话已更新 familyId=${familyId}`);
        }).catch((dbErr) => {
          log.warn('[chat] 会话更新失败:', dbErr.message);
        });
      }
    });

    stream.on('error', (err) => {
      log.error('[chat] stream error:', err.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      }
    });

  } catch (err) {
    log.error('[chat] 请求发起失败:', err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// 路由：POST /amapapi/extract  结构化抽取（保留兼容）
// ============================================================
app.post('/amapapi/extract', async (req, res) => {
  const { conversationText, familyId } = req.body;

  log.ai(`[extract] 开始  textLen=${conversationText?.length || 0}  familyId=${familyId || '无'}`);
  log.ai(`[extract] 模型=${QWEN_MODEL_HEAVY}`);

  const EXTRACTION_PROMPT = `你是家族历史信息抽取专家。从以下对话中抽取家族迁徙信息。

必须输出合法 JSON，不得有任何其他文字。格式严格如下：
{
  "family_name": "姓氏或家族名",
  "persons": [
    {
      "internal_id": "p1",
      "role": "本人|父亲|母亲|爷爷|奶奶|外公|外婆",
      "name": "姓名（未知时使用角色名，如"父亲"）",
      "birth_year": 1970,
      "birth_place": "原始地名",
      "occupation": "职业",
      "generation": 0
    }
  ],
  "migrations": [
    {
      "person_internal_id": "p1",
      "from_place": "出发地",
      "to_place": "目的地",
      "year": 1990,
      "year_approx": false,
      "reason": "迁徙原因描述",
      "reason_type": "study|work|war|disaster|assignment|family|unknown",
      "emotion_weight": "low|medium|high",
      "sequence_order": 1
    }
  ],
  "relationships": [
    { "from_id": "p1", "to_id": "p2", "type": "父子" }
  ]
}

规则：
- generation: 0=本人, 1=父辈, 2=祖辈, -1=子辈
- emotion_weight: 重大历史背景下的迁徙填high，普通求学填medium，日常移居填low
- sequence_order 全局递增，按时间排序
- name 字段：如果对话中没有提到具体姓名，直接使用 role 的值（如"父亲"、"爷爷"）

对话内容：
${conversationText}`;

  try {
    log.ai('[extract] 调用 LLM...');
    const t0 = Date.now();

    const response = await anthropic.messages.create({
      model:      QWEN_MODEL_HEAVY,
      max_tokens: 2000,
      messages:   [{ role: 'user', content: EXTRACTION_PROMPT }],
    });

    const elapsed = Date.now() - t0;
    log.ai(`[extract] LLM 完成  耗时=${elapsed}ms  tokens=${response.usage?.output_tokens || '?'}`);

    const rawJson  = response.content[0].text;
    log.ai('[extract] 原始输出(前200字):', rawJson.slice(0, 200));

    const cleanJson = rawJson.replace(/```json\n?|\n?```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanJson);
      log.ok(`[extract] JSON解析成功  persons=${data.persons?.length}  migrations=${data.migrations?.length}`);
    } catch (parseErr) {
      log.error('[extract] JSON解析失败:', parseErr.message);
      log.error('[extract] 原始内容:', cleanJson.slice(0, 500));
      return res.status(500).json({ success: false, error: 'JSON解析失败: ' + parseErr.message, raw: cleanJson });
    }

    let fid = familyId;

    if (!fid) {
      const fp = await db.query(
        `INSERT INTO family_profiles (family_name, raw_input, status)
         VALUES ($1, $2, 'processing') RETURNING id`,
        [data.family_name, conversationText]
      );
      fid = fp.rows[0].id;
      log.db(`[extract] 新建 family_profile  id=${fid}  name=${data.family_name}`);
    } else {
      log.db(`[extract] 重新分析，先删除旧数据 familyId=${fid}`);
      await db.query('DELETE FROM migrations WHERE family_id=$1', [fid]);
      await db.query('DELETE FROM persons WHERE family_id=$1', [fid]);
    }

    const personIdMap = {};
    for (const p of data.persons) {
      const result = await db.query(
        `INSERT INTO persons
           (family_id, internal_id, role, name, birth_year, birth_place, occupation, generation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [fid, p.internal_id, p.role, p.name || '未知',
         p.birth_year, p.birth_place, p.occupation, p.generation]
      );
      personIdMap[p.internal_id] = result.rows[0].id;
      log.db(`[extract] 插入人物: ${p.role}(${p.internal_id}) → db.id=${result.rows[0].id}`);
    }

    for (const m of data.migrations) {
      log.info(`[extract] 处理迁徙: ${m.from_place} → ${m.to_place}  year=${m.year}`);

      // 验证 reason_type 必须是预定义的枚举值
      const VALID_REASON_TYPES = ['study', 'work', 'war', 'disaster', 'assignment', 'family', 'unknown'];
      const sanitizedReasonType = VALID_REASON_TYPES.includes(m.reason_type) ? m.reason_type : 'unknown';
      const fromGeo = await geocodePlace(m.from_place);
      const toGeo   = await geocodePlace(m.to_place);

      const fromPlace = await db.query('SELECT id FROM places WHERE raw_name=$1', [m.from_place]);
      const toPlace   = await db.query('SELECT id FROM places WHERE raw_name=$1', [m.to_place]);

      const personDbId = personIdMap[m.person_internal_id];
      if (!personDbId) {
        log.warn(`[extract] 找不到 person_internal_id=${m.person_internal_id}，跳过此迁徙`);
        continue;
      }

      // 使用服务端规则计算 emotion_weight，不依赖 LLM 主观判断
      const emotionWeight = resolveEmotionWeight(sanitizedReasonType, m.year, null);

      await db.query(
        `INSERT INTO migrations
           (family_id, person_id, from_place_id, to_place_id,
            from_place_raw, to_place_raw, year, year_approx,
            reason, reason_type, emotion_weight, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          fid, personDbId,
          fromPlace.rows[0]?.id,
          toPlace.rows[0]?.id,
          m.from_place, m.to_place,
          m.year, m.year_approx || false,
          m.reason, sanitizedReasonType,
          emotionWeight, m.sequence_order,
        ]
      );
      log.db(`[extract] 迁徙已入库: ${m.from_place} → ${m.to_place}`);
    }

    await db.query(
      `UPDATE family_profiles SET status='ready', ai_confidence=0.85 WHERE id=$1`, [fid]
    );
    log.ok(`[extract] 全部完成  familyId=${fid}`);

    res.json({ success: true, familyId: fid, data });

  } catch (err) {
    log.error('[extract] 异常:', err.message);
    log.error('[extract] stack:', err.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 路由：GET /amapapi/migration-map/:familyId
// ============================================================
app.get('/amapapi/migration-map/:familyId', async (req, res) => {
  const { familyId } = req.params;
  log.info(`[migration-map] 查询 familyId=${familyId}`);

  try {
    const paths = await db.query(`
      SELECT
        m.id,
        m.family_id,
        m.sequence_order,
        m.person_id,
        p.internal_id AS person_internal_id,
        p.role AS person_role,
        p.name AS person_name,
        p.generation,
        fp.raw_name AS from_place,
        m.from_place_raw,
        fp.longitude AS from_lng,
        fp.latitude AS from_lat,
        tp.raw_name AS to_place,
        m.to_place_raw,
        tp.longitude AS to_lng,
        tp.latitude AS to_lat,
        m.year,
        m.reason,
        m.reason_type,
        m.emotion_weight,
        m.narrative
      FROM migrations m
      JOIN persons p ON m.person_id = p.id
      LEFT JOIN places fp ON m.from_place_id = fp.id
      LEFT JOIN places tp ON m.to_place_id = tp.id
      WHERE m.family_id = $1
      ORDER BY m.sequence_order
    `, [familyId]);

    const processedPaths = paths.rows.map(row => ({
      ...row,
      from_place: row.from_place || row.from_place_raw || '未知',
      to_place: row.to_place || row.to_place_raw || '未知',
      from_lng: row.from_lng,
      from_lat: row.from_lat,
      to_lng: row.to_lng,
      to_lat: row.to_lat,
      narrative: row.narrative || null  // 保留叙事字段
    }));

    const persons = await db.query(`SELECT * FROM persons WHERE family_id=$1 ORDER BY generation DESC`, [familyId]);
    const family = await db.query(`SELECT family_name FROM family_profiles WHERE id=$1`, [familyId]);

    log.db(`[migration-map] paths=${processedPaths.length}  persons=${persons.rows.length}`);

    const events = [];
    for (const row of processedPaths) {
      if (row.year) {
        const matched = await matchHistoricalEvents(row.year);
        if (matched.length > 0) events.push({ migration_id: row.id, year: row.year, events: matched });
      }
    }

    const missingCoords = processedPaths.filter(r => !r.from_lng || !r.to_lng);
    if (missingCoords.length > 0) {
      log.warn(`[migration-map] ${missingCoords.length} 条迁徙缺少坐标:`,
        missingCoords.map(r => `${r.from_place}→${r.to_place}`).join(', '));

      // 动态获取缺失的坐标
      for (const row of missingCoords) {
        if (!row.from_lng && row.from_place_raw) {
          const geo = await geocodePlace(row.from_place_raw);
          if (geo) {
            row.from_lng = geo.longitude;
            row.from_lat = geo.latitude;
            log.ok(`[migration-map] 动态补全坐标：${row.from_place_raw} → ${geo.longitude}, ${geo.latitude}`);
          }
        }
        if (!row.to_lng && row.to_place_raw) {
          const geo = await geocodePlace(row.to_place_raw);
          if (geo) {
            row.to_lng = geo.longitude;
            row.to_lat = geo.latitude;
            log.ok(`[migration-map] 动态补全坐标：${row.to_place_raw} → ${geo.longitude}, ${geo.latitude}`);
          }
        }
      }
    }

    log.ok(`[migration-map] 返回成功  events=${events.length}`);
    res.json({
      success: true,
      familyName: family.rows[0]?.family_name || '您的家族',
      paths: processedPaths,
      persons: persons.rows,
      historicalEvents: events
    });

  } catch (err) {
    log.error('[migration-map] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 路由：GET /amapapi/demo-stories
// ============================================================
app.get('/amapapi/demo-stories', async (req, res) => {
  log.info('[demo-stories] 获取演示家族故事列表');

  try {
    const stories = await db.query(`
      SELECT
        fp.id,
        fp.family_name,
        fp.ai_confidence,
        COUNT(DISTINCT p.id) AS person_count,
        COUNT(DISTINCT m.id) AS migration_count,
        MIN(p.birth_year) AS earliest_year,
        MAX(p.birth_year) AS latest_year
      FROM family_profiles fp
      LEFT JOIN persons p ON fp.id = p.family_id
      LEFT JOIN migrations m ON fp.id = m.family_id
      WHERE fp.id IN (
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440004'
      )
      GROUP BY fp.id, fp.family_name, fp.ai_confidence
      ORDER BY fp.created_at
    `);

    const storyList = stories.rows.map(row => ({
      id: row.id,
      familyName: row.family_name,
      title: getStoryTitle(row.family_name),
      period: getStoryPeriod(row.family_name),
      stats: {
        generations: Math.ceil(row.person_count / 2),
        years: row.latest_year - row.earliest_year || 0,
        cities: Math.ceil(row.migration_count / 1.5)
      }
    }));

    log.ok(`[demo-stories] 返回 ${storyList.length} 个故事`);
    res.json({ success: true, stories: storyList });

  } catch (err) {
    log.error('[demo-stories] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function getStoryTitle(familyName) {
  const titles = {
    '林家': '闯关东 (1890-1895)',
    '陈家': '抗战西迁 (1937-1946)',
    '赵家': '三线建设 (1964-1982)',
    '周家': '南下创业 (1985-2010)'
  };
  return titles[familyName] || '家族迁徙';
}

function getStoryPeriod(familyName) {
  const periods = {
    '林家': '清末',
    '陈家': '抗战',
    '赵家': '建国后',
    '周家': '改革开放'
  };
  return periods[familyName] || '近代';
}

// ============================================================
// 路由：POST /amapapi/save-edit/:familyId
// ============================================================
app.post('/amapapi/save-edit/:familyId', async (req, res) => {
  const { familyId } = req.params;
  const { personId, name, role, migrationId, year, fromPlace, toPlace, reason } = req.body;

  log.db(`[save-edit] 开始 familyId=${familyId}`, { personId, name, role, migrationId });

  try {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      if (personId) {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (name) {
          paramCount++;
          updates.push(`name = $${paramCount}`);
          values.push(name);
        }
        if (role) {
          paramCount++;
          updates.push(`role = $${paramCount}`);
          values.push(role);
        }

        if (updates.length > 0) {
          paramCount++;
          values.push(personId);
          await client.query(
            `UPDATE persons SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
          );
          log.db(`[save-edit] 人物已更新 personId=${personId}`);
        }
      }

      if (migrationId) {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (year) {
          paramCount++;
          updates.push(`year = $${paramCount}`);
          values.push(parseInt(year));
        }
        if (fromPlace) {
          paramCount++;
          updates.push(`from_place_raw = $${paramCount}`);
          values.push(fromPlace);
          const fromGeo = await geocodePlace(fromPlace);
          if (fromGeo) {
            const existingPlace = await client.query('SELECT id FROM places WHERE raw_name = $1', [fromPlace]);
            if (existingPlace.rows.length === 0) {
              await client.query(
                `INSERT INTO places (raw_name, normalized_name, longitude, latitude) VALUES ($1, $2, $3, $4)`,
                [fromPlace, fromGeo.formatted || fromPlace, fromGeo.lng, fromGeo.lat]
              );
            }
            const place = await client.query('SELECT id FROM places WHERE raw_name = $1', [fromPlace]);
            updates.push(`from_place_id = $${++paramCount}`);
            values.push(place.rows[0]?.id);
          }
        }
        if (toPlace) {
          paramCount++;
          updates.push(`to_place_raw = $${paramCount}`);
          values.push(toPlace);
          const toGeo = await geocodePlace(toPlace);
          if (toGeo) {
            const existingPlace = await client.query('SELECT id FROM places WHERE raw_name = $1', [toPlace]);
            if (existingPlace.rows.length === 0) {
              await client.query(
                `INSERT INTO places (raw_name, normalized_name, longitude, latitude) VALUES ($1, $2, $3, $4)`,
                [toPlace, toGeo.formatted || toPlace, toGeo.lng, toGeo.lat]
              );
            }
            const place = await client.query('SELECT id FROM places WHERE raw_name = $1', [toPlace]);
            updates.push(`to_place_id = $${++paramCount}`);
            values.push(place.rows[0]?.id);
          }
        }
        if (reason) {
          paramCount++;
          updates.push(`reason = $${paramCount}`);
          values.push(reason);
        }

        if (updates.length > 0) {
          paramCount++;
          values.push(migrationId);
          await client.query(
            `UPDATE migrations SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
          );
          log.db(`[save-edit] 迁徙已更新 migrationId=${migrationId}`);
        }
      }

      await client.query('COMMIT');
      log.ok(`[save-edit] 完成 familyId=${familyId}`);
      res.json({ success: true });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    log.error('[save-edit] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 路由：POST /amapapi/generate-story/:familyId
// ============================================================
app.post('/amapapi/generate-story/:familyId', async (req, res) => {
  const { familyId } = req.params;
  log.ai(`[generate-story] 开始  familyId=${familyId}  模型=${QWEN_MODEL_HEAVY}`);

  try {
    const mapData = await db.query(`SELECT * FROM v_migration_paths WHERE family_id=$1`, [familyId]);
    const persons = await db.query(`SELECT * FROM persons WHERE family_id=$1`, [familyId]);

    log.ai(`[generate-story] 数据: persons=${persons.rows.length}  paths=${mapData.rows.length}`);

    const STORY_PROMPT = `你是家族史叙事大师。根据以下家族迁徙数据，生成叙事章节。

叙事风格原则：
1. 用具体细节，不用抽象赞美
2. 多用"他不知道……"制造时间折叠感
3. 每段不超过3句，克制有力
4. 绝不使用"了不起""艰辛""伟大"等外露词汇
5. 历史事件作背景，人物是主角

家族数据：
人物：${JSON.stringify(persons.rows, null, 2)}
迁徙路径：${JSON.stringify(mapData.rows, null, 2)}

输出严格 JSON，格式：
{
  "chapters": [
    {
      "sequence_order": 1,
      "beat_type": "anchor",
      "narration": "叙事文本",
      "pause_seconds": 4,
      "map_action": { "type": "show_place", "place": "地名", "zoom": 8 },
      "historical_context": "可选的历史背景说明"
    }
  ]
}

beat_type 枚举: anchor | person | danger | meeting | choice | arrival | silence`;

    const t0 = Date.now();
    const response = await anthropic.messages.create({
      model:      QWEN_MODEL_HEAVY,
      max_tokens: 3000,
      messages:   [{ role: 'user', content: STORY_PROMPT }],
    });

    log.ai(`[generate-story] LLM 完成  耗时=${Date.now()-t0}ms  tokens=${response.usage?.output_tokens || '?'}`);

    const rawText   = response.content[0].text;
    const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();

    let storyData;
    try {
      storyData = JSON.parse(cleanJson);
      log.ok(`[generate-story] JSON解析成功  chapters=${storyData.chapters?.length}`);
    } catch (parseErr) {
      log.error('[generate-story] JSON解析失败:', parseErr.message);
      return res.status(500).json({ success: false, error: 'JSON解析失败', raw: cleanJson });
    }

    for (const ch of storyData.chapters) {
      await db.query(
        `INSERT INTO story_chapters
           (family_id, sequence_order, beat_type, narration, pause_seconds, map_action)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [familyId, ch.sequence_order, ch.beat_type,
         ch.narration, ch.pause_seconds, JSON.stringify(ch.map_action)]
      );
    }

    log.ok(`[generate-story] ${storyData.chapters.length} 章节已写入数据库`);
    res.json({ success: true, chapters: storyData.chapters });

  } catch (err) {
    log.error('[generate-story] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 路由：GET /amapapi/geocode
// ============================================================
app.get('/amapapi/geocode', async (req, res) => {
  const { place } = req.query;
  if (!place) return res.status(400).json({ error: 'place 参数必填' });

  log.info(`[geocode] 查询: "${place}"`);
  const result = await geocodePlace(place);
  log.ok(`[geocode] 结果:`, result);
  res.json({ success: !!result, data: result });
});

// ============================================================
// 路由：GET /amapapi/health
// ============================================================
app.get('/amapapi/health', async (req, res) => {
  const health = {
    status:   'ok',
    time:     new Date().toISOString(),
    db:       false,
    ai_key:   !!process.env.DASHSCOPE_API_KEY,
    ai_url:   process.env.ANTHROPIC_BASE_URL || '(default)',
    amap_key: !!process.env.AMAP_KEY,
    model_chat:  QWEN_MODEL,
    model_heavy: QWEN_MODEL_HEAVY,
  };

  try {
    await db.query('SELECT 1');
    health.db = true;
  } catch {}

  log.info('[health]', JSON.stringify(health));
  res.json(health);
});

// ============================================================
// 路由：GET /amapapi/check-data
// 数据健康检查
// ============================================================
app.get('/amapapi/check-data', async (req, res) => {
  log.info('[check-data] 开始数据健康检查');

  try {
    const issues = {
      missing_coords: [],
      orphan_migrations: [],
      orphan_places: [],
      orphan_persons: [],
      incomplete_families: [],
    };

    // 1. 检查缺少坐标的迁徙记录
    const missingCoords = await db.query(`
      SELECT
        m.id, m.family_id, m.person_id,
        m.from_place_raw, m.to_place_raw,
        m.from_place_id, m.to_place_id,
        fp.family_name,
        p.role AS person_role,
        p.name AS person_name,
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
      ORDER BY m.year
    `);
    issues.missing_coords = missingCoords.rows;

    // 2. 检查孤立的迁徙记录
    const orphanMigrations = await db.query(`
      SELECT m.id, m.from_place_id, m.to_place_id, m.from_place_raw, m.to_place_raw,
             '引用不存在的地点' AS issue
      FROM migrations m
      WHERE (m.from_place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM places WHERE id = m.from_place_id))
         OR (m.to_place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM places WHERE id = m.to_place_id))
    `);
    issues.orphan_migrations = orphanMigrations.rows;

    // 3. 检查孤立的地点
    const orphanPlaces = await db.query(`
      SELECT p.id, p.raw_name, p.normalized_name, '无迁徙引用' AS status
      FROM places p
      WHERE p.id NOT IN (SELECT DISTINCT from_place_id FROM migrations WHERE from_place_id IS NOT NULL)
        AND p.id NOT IN (SELECT DISTINCT to_place_id FROM migrations WHERE to_place_id IS NOT NULL)
    `);
    issues.orphan_places = orphanPlaces.rows;

    // 4. 检查不完整的人物
    const orphanPersons = await db.query(`
      SELECT p.id, p.family_id, p.role, p.name, p.birth_year, '无迁徙记录' AS status
      FROM persons p
      WHERE p.id NOT IN (SELECT DISTINCT person_id FROM migrations WHERE person_id IS NOT NULL)
    `);
    issues.orphan_persons = orphanPersons.rows;

    // 5. 检查不完整的家族
    const incompleteFamilies = await db.query(`
      SELECT
        fp.id, fp.family_name, fp.status,
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
    `);
    issues.incomplete_families = incompleteFamilies.rows;

    const totalIssues =
      issues.missing_coords.length +
      issues.orphan_migrations.length +
      issues.orphan_places.length +
      issues.orphan_persons.length +
      issues.incomplete_families.length;

    const summary = {
      total_migrations: await db.query('SELECT COUNT(*) FROM migrations').then(r => parseInt(r.rows[0].count)),
      total_places: await db.query('SELECT COUNT(*) FROM places').then(r => parseInt(r.rows[0].count)),
      total_persons: await db.query('SELECT COUNT(*) FROM persons').then(r => parseInt(r.rows[0].count)),
      total_families: await db.query('SELECT COUNT(*) FROM family_profiles').then(r => parseInt(r.rows[0].count)),
      total_issues: totalIssues,
    };

    log.ok(`[check-data] 完成 总记录=${JSON.stringify(summary)} 问题=${totalIssues}`);
    res.json({ success: true, summary, issues });

  } catch (err) {
    log.error('[check-data] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 路由：POST /amapapi/fix-data
// 自动修复数据问题
// ============================================================
app.post('/amapapi/fix-data', async (req, res) => {
  log.info('[fix-data] 开始自动修复数据');

  try {
    const result = {
      created_places: [],
      updated_migrations: [],
      cleaned: [],
      errors: [],
    };

    // 0. 清理脏数据：将空字符串转为 NULL
    const cleanResult = await db.query(`
      UPDATE migrations
      SET from_place_id = NULL
      WHERE from_place_id = ''
    `);
    if (cleanResult.rowCount > 0) {
      result.cleaned.push({ field: 'from_place_id', count: cleanResult.rowCount });
      log.db(`[fix-data] 清理 from_place_id 空字符串 ${cleanResult.rowCount} 条`);
    }

    const cleanResult2 = await db.query(`
      UPDATE migrations
      SET to_place_id = NULL
      WHERE to_place_id = ''
    `);
    if (cleanResult2.rowCount > 0) {
      result.cleaned.push({ field: 'to_place_id', count: cleanResult2.rowCount });
      log.db(`[fix-data] 清理 to_place_id 空字符串 ${cleanResult2.rowCount} 条`);
    }

    // 1. 为缺少地点 ID 的迁徙记录创建地点（只处理 IS NULL）
    const missingFromPlaces = await db.query(`
      SELECT DISTINCT m.from_place_raw AS raw_name
      FROM migrations m
      WHERE m.from_place_id IS NULL
        AND m.from_place_raw IS NOT NULL AND m.from_place_raw != ''
    `);

    for (const row of missingFromPlaces.rows) {
      // 检查是否已存在同名地点
      const existing = await db.query('SELECT id FROM places WHERE raw_name = $1', [row.raw_name]);

      if (existing.rows.length > 0) {
        // 已存在，直接更新迁徙记录
        await db.query(
          'UPDATE migrations SET from_place_id = $1 WHERE from_place_raw = $2 AND m.from_place_id IS NULL',
          [existing.rows[0].id, row.raw_name]
        );
        result.updated_migrations.push({ action: 'linked_existing', place: row.raw_name, type: 'from_place' });
      } else {
        // 创建新地点
        const newPlace = await db.query(
          `INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude, country)
           VALUES (uuid_generate_v4(), $1, $1, NULL, NULL, NULL, NULL, '中国')
           RETURNING id, raw_name`,
          [row.raw_name]
        );
        await db.query(
          'UPDATE migrations SET from_place_id = $1 WHERE from_place_raw = $2 AND m.from_place_id IS NULL',
          [newPlace.rows[0].id, row.raw_name]
        );
        result.created_places.push({ raw_name: row.raw_name, id: newPlace.rows[0].id, type: 'from_place' });
      }
    }

    // 2. 处理 to_place
    const missingToPlaces = await db.query(`
      SELECT DISTINCT m.to_place_raw AS raw_name
      FROM migrations m
      WHERE m.to_place_id IS NULL
        AND m.to_place_raw IS NOT NULL AND m.to_place_raw != ''
    `);

    for (const row of missingToPlaces.rows) {
      const existing = await db.query('SELECT id FROM places WHERE raw_name = $1', [row.raw_name]);

      if (existing.rows.length > 0) {
        await db.query(
          'UPDATE migrations SET to_place_id = $1 WHERE to_place_raw = $2 AND m.to_place_id IS NULL',
          [existing.rows[0].id, row.raw_name]
        );
        result.updated_migrations.push({ action: 'linked_existing', place: row.raw_name, type: 'to_place' });
      } else {
        const newPlace = await db.query(
          `INSERT INTO places (id, raw_name, normalized_name, province, city, longitude, latitude, country)
           VALUES (uuid_generate_v4(), $1, $1, NULL, NULL, NULL, NULL, '中国')
           RETURNING id, raw_name`,
          [row.raw_name]
        );
        await db.query(
          'UPDATE migrations SET to_place_id = $1 WHERE to_place_raw = $2 AND m.to_place_id IS NULL',
          [newPlace.rows[0].id, row.raw_name]
        );
        result.created_places.push({ raw_name: row.raw_name, id: newPlace.rows[0].id, type: 'to_place' });
      }
    }

    log.ok(`[fix-data] 完成 创建地点=${result.created_places.length} 更新迁徙=${result.updated_migrations.length}`);
    res.json({ success: true, result });

  } catch (err) {
    log.error('[fix-data] 异常:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// ★ AGENT：工具定义
// ============================================================
const AGENT_TOOLS = [
  {
    name: 'save_person',
    description: '当用户确认了某人的信息（出生地/出生年份/职业等）时立即调用保存。同一角色多次补充信息时重复调用，会自动合并更新，不会重复创建。',
    input_schema: {
      type: 'object',
      properties: {
        role:        { type: 'string',  enum: ['本人','父亲','母亲','爷爷','奶奶','外公','外婆','其他'], description: '人物角色' },
        name:        { type: 'string',  description: '姓名，不知道时省略此字段' },
        birth_year:  { type: 'integer', description: '出生年份，不知道时省略此字段' },
        birth_place: { type: 'string',  description: '出生地，尽量精确到县市' },
        occupation:  { type: 'string',  description: '职业，不知道时省略此字段' },
        generation:  { type: 'integer', description: '代际：0=本人，1=父辈，2=祖辈' },
      },
      required: ['role', 'generation'],
    },
  },
  {
    name: 'save_migration',
    description: '用户提到某次搬迁/移居/去某地工作或读书时立即调用。必须先保存对应人物（save_person）才能调用此工具。',
    input_schema: {
      type: 'object',
      properties: {
        person_role:  { type: 'string',  description: '迁徙者的角色，与 save_person 的 role 字段一致' },
        from_place:   { type: 'string',  description: '出发地，不知道时省略' },
        to_place:     { type: 'string',  description: '目的地（必填）' },
        year:         { type: 'integer', description: '迁徙年份，不确定时省略' },
        year_approx:  { type: 'boolean', description: '年份是否为估算值，默认 false' },
        reason:       { type: 'string',  description: '迁徙原因的简短描述' },
        reason_type:  { type: 'string',  enum: ['study','work','war','disaster','assignment','family','unknown'] },
      },
      required: ['person_role', 'to_place'],
    },
  },
  {
    name: 'geocode_and_verify',
    description: '验证地名是否可被识别为有效地理坐标。遇到不常见或表述模糊的地名时调用，根据结果决定是否追问用户更精确的地名。',
    input_schema: {
      type: 'object',
      properties: {
        place_name: { type: 'string', description: '需要验证的地名' },
      },
      required: ['place_name'],
    },
  },
  {
    name: 'query_historical_context',
    description: '根据年份查询对应的重要历史背景事件，用于理解迁徙原因，并在对话中自然地融入历史维度。用户提到具体年份+迁徙时调用。',
    input_schema: {
      type: 'object',
      properties: {
        year:   { type: 'integer', description: '要查询的年份' },
        region: { type: 'string',  description: '地区，可选：省份名 或 national（默认）' },
      },
      required: ['year'],
    },
  },
  {
    name: 'mark_collection_complete',
    description: '当已收集到3代及以上人物信息、且每代人都有至少一个迁徙节点时调用，标志信息采集完整，系统将自动触发地图生成流程。',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '简短总结已收集的内容，如"收集了王姓家族3代，共5次迁徙"' },
      },
      required: ['summary'],
    },
  },
];

const AGENT_SYSTEM = `你是"寻根"平台的家族故事采集助手。你通过温暖的对话收集用户家族的迁徙历史，并在对话过程中悄悄调用工具保存信息。

【工具调用时机——每当出现以下情况时立即调用，不要等到对话结束】
- 用户确认了某人的出生地或出生年份 → save_person
- 用户提到某次搬迁/去某地工作/读书 → save_migration（需先 save_person）
- 遇到不常见或表述模糊的地名 → 先 geocode_and_verify，再决定是否追问
- 用户提到具体年份 → query_historical_context，把背景自然融入回复
- 已收集到3代+主要迁徙节点完整 → mark_collection_complete

【对话策略】
1. 每次只问一个问题，不要连续提问
2. 收集顺序：本人 → 父辈 → 祖辈
3. 核心信息：出生地、迁徙地点与年份、迁徙原因
4. 语气温暖自然，像老朋友聊天，不像填表格
5. 历史背景查到后，自然地融入回复（如"那正是文化大革命期间，很多人都被下放到农村……"）

【重要约束】工具调用在后台静默执行，绝不向用户说"我正在保存"之类的话，直接继续对话。`;


// ============================================================
// 迁徙情感权重推断（服务端规则，不依赖 LLM 主观判断）
// ============================================================
function resolveEmotionWeight(reasonType, year, ctx) {
  // ── 第一优先级：reason_type 直接决定 ──────────────────────
  const HIGH_TYPES = new Set(['war', 'disaster']);
  const LOW_TYPES  = new Set(['family']);   // 纯家庭团聚，情感平稳

  if (HIGH_TYPES.has(reasonType)) return 'high';
  if (LOW_TYPES.has(reasonType))  return 'low';

  // ── 第二优先级：历史年份区间 ──────────────────────────────
  if (year) {
    // 重大历史节点区间 → high
    const HIGH_PERIODS = [
      [1937, 1945],  // 抗战
      [1959, 1961],  // 三年困难时期
      [1966, 1976],  // 文化大革命
      [1927, 1936],  // 民国战乱 / 闯关东高峰
      [1949, 1952],  // 解放战争尾声 / 土改
    ];
    for (const [s, e] of HIGH_PERIODS) {
      if (year >= s && year <= e) {
        log.ai(`[emotion] year=${year} 落入历史高权重区间 [${s}-${e}] → high`);
        return 'high';
      }
    }

    // 社会变迁节点 → medium（已是默认，但明确列出便于维护）
    const MEDIUM_PERIODS = [
      [1953, 1958],  // 一五计划 / 三线建设前期
      [1977, 1985],  // 改革开放初期
      [1992, 2005],  // 市场经济 / 大学扩招 / 下岗潮
    ];
    for (const [s, e] of MEDIUM_PERIODS) {
      if (year >= s && year <= e) {
        log.ai(`[emotion] year=${year} 落入社会变迁区间 [${s}-${e}] → medium`);
        return 'medium';
      }
    }
  }

  // ── 第三优先级：reason_type 细分 ──────────────────────────
  const MEDIUM_TYPES = new Set(['work', 'assignment', 'unknown']);
  const LOW_MEDIUM_TYPES = new Set(['study']);

  if (MEDIUM_TYPES.has(reasonType))      return 'medium';
  if (LOW_MEDIUM_TYPES.has(reasonType))  return 'low';

  // ── 兜底 ──────────────────────────────────────────────────
  return 'medium';
}
// ============================================================
// ★ AGENT：工具执行器
// ============================================================
async function executeAgentTool(toolName, toolInput, ctx) {
  // ctx = { familyId, personMap: {role→dbId}, isComplete }

  switch (toolName) {

    case 'save_person': {
      const { role, name, birth_year, birth_place, occupation, generation } = toolInput;

      // 已存在该角色 → 更新
      if (ctx.personMap[role]) {
        const sets = [], vals = [];
        let i = 1;
        if (name)        { sets.push(`name=$${i++}`);        vals.push(name); }
        if (birth_year)  { sets.push(`birth_year=$${i++}`);  vals.push(birth_year); }
        if (birth_place) { sets.push(`birth_place=$${i++}`); vals.push(birth_place); }
        if (occupation)  { sets.push(`occupation=$${i++}`);  vals.push(occupation); }
        if (sets.length) {
          vals.push(ctx.personMap[role]);
          await db.query(`UPDATE persons SET ${sets.join(',')} WHERE id=$${i}`, vals);
          log.db(`[agent] 更新人物 ${role}  id=${ctx.personMap[role]}`);
        }
        return { ok: true, action: 'updated', person_id: ctx.personMap[role], role };
      }

      // 首次保存人物 → 可能需先建 family_profile
      if (!ctx.familyId) {
        const fp = await db.query(
          `INSERT INTO family_profiles (family_name, status) VALUES ($1, 'collecting') RETURNING id`,
          [name ? `${name}家族` : `${role}的家族`]
        );
        ctx.familyId = fp.rows[0].id;
        log.db(`[agent] 新建 family_profile  id=${ctx.familyId}`);
      }

      const iid = 'p' + Date.now().toString(36);  // 固定9位，永不超限
      const r = await db.query(
        `INSERT INTO persons (family_id, internal_id, role, name, birth_year, birth_place, occupation, generation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [ctx.familyId, iid, role, name || role,
         birth_year || null, birth_place || null, occupation || null, generation]
      );
      ctx.personMap[role] = r.rows[0].id;
      log.db(`[agent] 新建人物 ${role}  db.id=${r.rows[0].id}`);
      return { ok: true, action: 'created', person_id: r.rows[0].id, family_id: ctx.familyId, role };
    }

    case 'save_migration': {
      const { person_role, from_place, to_place, year, year_approx, reason, reason_type } = toolInput;

      const personId = ctx.personMap[person_role];
      if (!personId) {
        return { ok: false, error: `人物 "${person_role}" 尚未保存，请先调用 save_person` };
      }
      if (!ctx.familyId) {
        return { ok: false, error: 'family_id 尚未创建，请先保存至少一个人物' };
      }

      // 验证 reason_type 必须是预定义的枚举值
      const VALID_REASON_TYPES = ['study', 'work', 'war', 'disaster', 'assignment', 'family', 'unknown'];
      const sanitizedReasonType = VALID_REASON_TYPES.includes(reason_type) ? reason_type : 'unknown';

      // 自动递增 sequence_order
      const seqR = await db.query(
        `SELECT COALESCE(MAX(sequence_order), 0) + 1 AS n FROM migrations WHERE family_id = $1`,
        [ctx.familyId]
      );
      const seq = seqR.rows[0].n;

      // 地理编码（后台静默执行）
      if (from_place) await geocodePlace(from_place).catch(() => null);
      if (to_place)   await geocodePlace(to_place).catch(() => null);

      const fromRow = from_place
        ? await db.query('SELECT id FROM places WHERE raw_name=$1', [from_place])
        : { rows: [] };
      const toRow = to_place
        ? await db.query('SELECT id FROM places WHERE raw_name=$1', [to_place])
        : { rows: [] };
      const emotionWeight = resolveEmotionWeight(sanitizedReasonType, year, ctx);
      await db.query(
        `INSERT INTO migrations
          (family_id, person_id, from_place_id, to_place_id,
            from_place_raw, to_place_raw, year, year_approx,
            reason, reason_type, emotion_weight, sequence_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          ctx.familyId, personId,
          fromRow.rows[0]?.id || null, toRow.rows[0]?.id || null,
          from_place || null, to_place,
          year || null, year_approx || false,
          reason || null, sanitizedReasonType,
          emotionWeight,
          seq,
        ]
      );
      log.db(`[agent] 迁徙入库: ${from_place || '?'} → ${to_place}  year=${year || '?'}  seq=${seq}`);
      return { ok: true, from: from_place, to: to_place, year, seq };
    }

    case 'geocode_and_verify': {
      const geo = await geocodePlace(toolInput.place_name).catch(() => null);
      if (geo) {
        return {
          ok: true, valid: true,
          place: toolInput.place_name,
          lng: geo.longitude, lat: geo.latitude,
          normalized: geo.normalized_name,
        };
      }
      return {
        ok: true, valid: false,
        place: toolInput.place_name,
        suggestion: '无法识别此地名，建议追问用户更精确的县市名称',
      };
    }

    case 'query_historical_context': {
      const events = await matchHistoricalEvents(toolInput.year, toolInput.region || 'national');
      return {
        ok: true,
        year: toolInput.year,
        events: events.map(e => ({ name: e.name, desc: e.description })),
      };
    }

   // 改后
case 'mark_collection_complete': {
  if (!ctx.familyId) {
    return { ok: false, error: '尚未保存任何人物，无法标记完成' };
  }

  // ── 服务端量化校验 ──────────────────────────────────────
  const genR = await db.query(
    `SELECT COUNT(DISTINCT generation) AS gen_count FROM persons WHERE family_id = $1`,
    [ctx.familyId]
  );
  const migR = await db.query(
    `SELECT COUNT(*) AS mig_count FROM migrations WHERE family_id = $1`,
    [ctx.familyId]
  );

  const genCount = parseInt(genR.rows[0].gen_count);
  const migCount = parseInt(migR.rows[0].mig_count);

  log.ai(`[agent] mark_complete 校验  代际=${genCount}  迁徙数=${migCount}`);

  if (genCount < 2) {
    return {
      ok: false,
      reason: 'insufficient_generations',
      current_generations: genCount,
      required_generations: 2,
      hint: `当前只收集了 ${genCount} 代人物，需要至少 2 代（本人+父辈，或加上祖辈更好）。请继续询问用户的父母或祖父母信息。`,
    };
  }

  if (migCount < 2) {
    return {
      ok: false,
      reason: 'insufficient_migrations',
      current_migrations: migCount,
      required_migrations: 2,
      hint: `当前只有 ${migCount} 条迁徙记录，需要至少 2 条。请继续询问家人的迁徙经历。`,
    };
  }

  // ── 校验通过，标记完成 ────────────────────────────────────
  await db.query(
    `UPDATE family_profiles SET status='ready', ai_confidence=0.90 WHERE id=$1`,
    [ctx.familyId]
  );
  ctx.isComplete = true;
  log.ok(`[agent] 收集完成  familyId=${ctx.familyId}  代际=${genCount}  迁徙=${migCount}  summary="${toolInput.summary}"`);

  return {
    ok: true,
    family_id: ctx.familyId,
    generations: genCount,
    migrations: migCount,
    summary: toolInput.summary,
  };
}

    default:
      return { ok: false, error: `未知工具: ${toolName}` };
  }
}

// ============================================================
// ★ AGENT：阶段推断（根据已保存人物决定当前收集阶段）
// ============================================================
function resolvePhase(ctx) {
  const roles    = Object.keys(ctx.personMap);
  const hasSelf  = roles.includes('本人');
  const hasParent = roles.some(r => ['父亲', '母亲'].includes(r));
  const hasGrand  = roles.some(r => ['爷爷', '奶奶', '外公', '外婆'].includes(r));

  // 尚未保存本人 → 本人信息轮
  if (!hasSelf)   return 'self_info';
  // 有本人但无迁徙数据（前端无法感知，这里保守判断）→ 本人迁徙轮
  if (!hasParent) return 'self_migration';
  // 有父辈但无祖辈 → 父辈信息/迁徙轮
  if (!hasGrand)  return 'parent_info';
  // 有祖辈 → 祖辈信息/迁徙轮
  return 'grand_info';
}

// ============================================================
// ★ 路由：POST /amapapi/agent   Agentic 对话（取代 /chat + /extract）
// ============================================================
app.post('/amapapi/agent', async (req, res) => {
  const { messages, familyId } = req.body;
  const startTime = Date.now();

  log.ai(`[agent] 开始  轮次=${messages?.length || 0}  familyId=${familyId || '无'}  model=${QWEN_MODEL}`);

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 运行时上下文（跨工具调用共享状态）
  const ctx = {
    familyId:   familyId || null,
    personMap:  {},        // role → db_id
    isComplete: false,
  };

  // 续谈场景：预载已有人物 ID 映射
  if (familyId) {
    try {
      const existing = await db.query(
        'SELECT id, role FROM persons WHERE family_id=$1', [familyId]
      );
      existing.rows.forEach(p => { ctx.personMap[p.role] = p.id; });
      log.db(`[agent] 预载人物映射: ${JSON.stringify(ctx.personMap)}`);
    } catch (e) {
      log.warn('[agent] 预载人物失败:', e.message);
    }
  }

  // 前端传来的是纯文本消息历史；工具调用上下文由 Agent loop 在服务端维护
  let loopMessages = messages.map(m => ({ role: m.role, content: String(m.content) }));

  const MAX_ITER = 10;
  let iter = 0;

  try {
    while (iter < MAX_ITER) {
      iter++;
      log.ai(`[agent] ── 第${iter}轮 LLM 调用 ──`);

      const resp = await anthropic.messages.create({
        model:      QWEN_MODEL,
        max_tokens: 800,
        system:     AGENT_SYSTEM,
        tools:      AGENT_TOOLS,
        messages:   loopMessages,
      });

      log.ai(`[agent] 第${iter}轮  stop=${resp.stop_reason}  types=[${resp.content.map(b => b.type).join(',')}]  tokens=${resp.usage?.output_tokens || '?'}`);

      // ── 分支一：模型请求调用工具 ──────────────────────────
      if (resp.stop_reason === 'tool_use') {
        const toolUses = resp.content.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const tu of toolUses) {
          log.ai(`[agent] 执行工具: ${tu.name}  input=${JSON.stringify(tu.input)}`);

          // 推送轻量事件给前端（前端显示保存指示器）
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: tu.name })}\n\n`);

          const result = await executeAgentTool(tu.name, tu.input, ctx);
          log.ai(`[agent] 工具结果: ${JSON.stringify(result)}`);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }

        // 过滤 thinking 块后追加到消息历史（避免兼容性问题）
        const assistantContent = resp.content.filter(b => b.type !== 'thinking');
        loopMessages = [
          ...loopMessages,
          { role: 'assistant', content: assistantContent },
          { role: 'user',      content: toolResults },
        ];
        continue;  // 继续 loop
      }

      // ── 分支二：end_turn，提取文本并推送给前端 ────────────
      const textBlock = resp.content.find(b => b.type === 'text');
      if (textBlock?.text) {
        const text = textBlock.text;
        // 分块推送，模拟流式打字效果（每 15 字一帧）
        const CHUNK = 15;
        for (let i = 0; i < text.length; i += CHUNK) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: text.slice(i, i + CHUNK) })}\n\n`);
        }
      }

      // 持久化会话（便于页面刷新后续谈）
      if (ctx.familyId) {
        const allMsgs = messages.concat(
          textBlock?.text ? [{ role: 'assistant', content: textBlock.text }] : []
        );
        db.query(
          `INSERT INTO chat_sessions (family_id, messages, is_complete, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (family_id)
           DO UPDATE SET messages=$2, is_complete=$3, updated_at=NOW()`,
          [ctx.familyId, JSON.stringify(allMsgs), ctx.isComplete]
        ).catch(e => log.warn('[agent] 会话持久化失败:', e.message));
      }

      const elapsed = Date.now() - startTime;
      const phase   = resolvePhase(ctx);
      log.ok(`[agent] 完成  耗时=${elapsed}ms  iters=${iter}  familyId=${ctx.familyId}  isComplete=${ctx.isComplete}  phase=${phase}`);

      res.write(`data: ${JSON.stringify({
        type:       'done',
        isComplete: ctx.isComplete,
        familyId:   ctx.familyId,
        phase:      phase,
      })}\n\n`);
      res.end();
      return;
    }

    // 超出最大迭代次数（理论上不应触发）
    log.warn(`[agent] 超出最大迭代次数 ${MAX_ITER}`);
    res.write(`data: ${JSON.stringify({
      type:       'done',
      isComplete: false,
      familyId:   ctx.familyId,
      warning:    'max_iterations_reached',
    })}\n\n`);
    res.end();

  } catch (err) {
    log.error('[agent] 异常:', err.message);
    log.error('[agent] stack:', err.stack);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// 全局错误处理
// ============================================================
app.use((err, req, res, _next) => {
  log.error('未捕获路由错误:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ============================================================
// 启动
// ============================================================
const PORT = process.env.PORT || 3005;
app.listen(PORT, async () => {
  console.log('');
  console.log(C.bold + '═══════════════════════════════════════════' + C.reset);
  console.log(C.bold + '  家族迁徙平台 API  [Agent 版]' + C.reset);
  console.log(C.bold + '═══════════════════════════════════════════' + C.reset);
  log.ok(`服务地址: http://localhost:${PORT}`);
  log.ok(`健康检查: http://localhost:${PORT}/amapapi/health`);
  log.ok(`Agent 端点: POST http://localhost:${PORT}/amapapi/agent`);
  console.log('');

  checkAI();
  checkAmap();
  await checkDB();

  console.log('');
  log.ok('服务已就绪，等待请求...');
  console.log('');
});
