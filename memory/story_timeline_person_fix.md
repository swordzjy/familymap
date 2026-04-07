---
name: story-timeline 人物信息匹配修复
description: 修复 story-timeline.html 无法匹配人物信息导致完整事件被误判为不完整的问题
type: feedback
---

**问题**：
story-timeline.html 页面显示所有迁徙事件都为"不完整"状态，即使 API 返回的数据中时间、地点、人物都齐全。

**根本原因**：
- `v_migration_paths` 视图没有包含 `person_id` 字段
- 前端 `personMap[path.person_internal_id]` 或 `personMap[path.person_id]` 无法匹配到人物
- `isPathComplete(path, person)` 函数中 `person` 始终为 `undefined`，导致判断失败

**修复方案**：
修改后端 `/amapapi/migration-map/:familyId` 端点，不再使用 `v_migration_paths` 视图，改为直接 JOIN 查询：

```sql
SELECT
  m.id, m.family_id, m.sequence_order, m.person_id,
  p.role AS person_role, p.name AS person_name, p.generation,
  fp.raw_name AS from_place, fp.longitude AS from_lng, fp.latitude AS from_lat,
  tp.raw_name AS to_place, tp.longitude AS to_lng, tp.latitude AS to_lat,
  m.year, m.reason, m.reason_type, m.emotion_weight
FROM migrations m
JOIN persons p ON m.person_id = p.id
LEFT JOIN places fp ON m.from_place_id = fp.id
LEFT JOIN places tp ON m.to_place_id = tp.id
WHERE m.family_id = $1
ORDER BY m.sequence_order
```

**前端匹配逻辑**（无需修改）：
```javascript
const personMap = {};
(data.persons || []).forEach(p => {
  personMap[p.internal_id || p.id] = p;
});

migrations.forEach(path => {
  const person = personMap[path.person_internal_id] || personMap[path.person_id];
  if (isPathComplete(path, person)) {
    // 完整事件
  }
});
```

**如何应用**：
- 当遇到前端无法匹配人物信息时，检查 API 返回的 `person_id` 字段是否存在
- 视图可能不包含所需的所有字段，必要时直接写 JOIN 查询
