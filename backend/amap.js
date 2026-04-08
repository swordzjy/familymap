// ============================================================
// 高德地图 API 工具集 · v4 安全版
// 文件: backend/amap.js
//
// v4 安全机制说明：
//   - Web 端（前端地图渲染）：通过 Nginx 代理注入 jscode，前端不持有安全密钥
//   - Web 服务（后端 HTTP 调用）：直接使用 key + jscode，在服务端安全调用
//     后端调用不经过浏览器，key 不暴露给用户，无需代理
// ============================================================

const axios = require('axios');

// 高德 Web 服务 API 基础地址
// 后端直接调用，不走 Nginx 代理（代理仅用于前端浏览器请求）
const RESTAPI_BASE = 'https://restapi.amap.com';

class AmapClient {
  /**
   * @param {string} apiKey  - 高德 Web 服务 API Key（后端专用）
   * @param {string} jscode  - 高德安全密钥（可选，后端调用时加在参数里）
   */
  constructor(apiKey, jscode = '') {
    this.key    = apiKey;
    this.jscode = jscode;
    this._cache = new Map();
  }

  // 构建带鉴权参数的请求参数
  _params(extra = {}) {
    const p = { key: this.key, output: 'JSON', ...extra };
    if (this.jscode) p.jscode = this.jscode;
    return p;
  }

  /**
   * 地理编码：地名 → 经纬度
   * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo
   */
  async geocode(address, city = "") {
    if (!address) return null;
    if (this._cache.has(address)) return this._cache.get(address);

    try {
      const params = this._params({ address });
      if (city) params.city = city;

      const res = await axios.get(`${RESTAPI_BASE}/v3/geocode/geo`, {
        params,
        timeout: 6000,
      });

      if (res.data.status !== '1' || !res.data.geocodes?.length) {
        console.warn(`[Amap] 未找到地址: ${address}`);
        return null;
      }

      const g   = res.data.geocodes[0];
      const [lng, lat] = g.location.split(',').map(Number);
      const result = {
        lng, lat,
        formatted: g.formatted_address,
        province:  g.province,
        // 直辖市时 city 字段为数组，退回用 province
        city:      Array.isArray(g.city) ? g.province : g.city,
        district:  g.district,
        adcode:    g.adcode,
      };

      this._cache.set(address, result);
      return result;

    } catch (err) {
      console.error(`[Amap] geocode 失败 "${address}":`, err.message);
      return null;
    }
  }

  /**
   * 批量地理编码（带限速，避免触发 QPS 上限）
   * 免费版 QPS = 2，间隔 500ms
   */
  async geocodeBatch(addresses) {
    const results = [];
    for (const addr of addresses) {
      const r = await this.geocode(addr);
      results.push({ address: addr, ...r });
      await sleep(500);
    }
    return results;
  }

  /**
   * 逆地理编码：经纬度 → 地名
   * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo#t8
   */
  async reverseGeocode(lng, lat) {
    try {
      const res = await axios.get(`${RESTAPI_BASE}/v3/geocode/regeo`, {
        params:  this._params({ location: `${lng},${lat}`, extensions: 'base' }),
        timeout: 6000,
      });

      if (res.data.status !== '1') return null;
      const reg = res.data.regeocode;
      return {
        formatted: reg.formatted_address,
        province:  reg.addressComponent.province,
        city:      reg.addressComponent.city,
        district:  reg.addressComponent.district,
      };

    } catch (err) {
      console.error('[Amap] reverseGeocode 失败:', err.message);
      return null;
    }
  }

  /**
   * POI 关键词搜索
   * 文档: https://lbs.amap.com/api/webservice/guide/api/search
   */
  async searchPOI(keywords, city) {
    try {
      const res = await axios.get(`${RESTAPI_BASE}/v3/place/text`, {
        params:  this._params({ keywords, city, offset: 5, page: 1, extensions: 'base' }),
        timeout: 6000,
      });

      if (res.data.status !== '1') return [];
      return (res.data.pois || []).map(poi => ({
        name:    poi.name,
        address: poi.address,
        lng:     parseFloat(poi.location.split(',')[0]),
        lat:     parseFloat(poi.location.split(',')[1]),
        type:    poi.type,
      }));

    } catch (err) {
      console.error('[Amap] searchPOI 失败:', err.message);
      return [];
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { AmapClient };