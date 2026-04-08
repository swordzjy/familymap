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
      // 如果缓存有坐标，直接返回
      if (row.longitude && row.latitude) {
        log.db(`地名缓存命中：${placeName} → ${row.longitude}, ${row.latitude}`);
        return row;
      }
      // 缓存记录但坐标为空 → 继续调用高德 API 获取坐标
      log.warn(`地名缓存命中但坐标为空：${placeName}，尝试重新获取`);
    }
  } catch (dbErr) {
    log.warn(`地名缓存查询失败 (${placeName}):`, dbErr.message);
  }

  // 2. 高德 API
  log.info(`调用高德地理编码："${placeName}"`);
  const geo = await amapClient.geocode(placeName);

  if (!geo) {
    // 先精确匹配 fallback
    const fallback = FALLBACK_COORDS[placeName];
    if (fallback) {
      log.warn(`高德失败，使用 FALLBACK (精确)：${placeName} → ${fallback.longitude}, ${fallback.latitude}`);
      return fallback;
    }
    // 模糊匹配 fallback（包含匹配）
    for (const [name, coords] of Object.entries(FALLBACK_COORDS)) {
      if (placeName.includes(name) || name.includes(placeName)) {
        log.warn(`高德失败，使用 FALLBACK (模糊)：${placeName} ≈ ${name} → ${coords.longitude}, ${coords.latitude}`);
        return { ...coords };
      }
    }
    log.error(`地理编码完全失败： "${placeName}"`);
    return null;
  }

  log.ok(`地理编码成功：${placeName} → ${geo.lng}, ${geo.lat} (${geo.formatted})`);

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
         geocode_source = 'amap'`,
      [placeName, geo.formatted, geo.province, geo.city, geo.lng, geo.lat]
    );
    log.db(`地名缓存已更新：${placeName}`);
  } catch (dbErr) {
    log.warn(`地名写入缓存失败 (${placeName}):`, dbErr.message);
  }

  return { longitude: geo.lng, latitude: geo.lat, normalized_name: geo.formatted };
}