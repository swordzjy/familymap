---
name: extract API 重复数据修复
description: 修复 /extract 端点在 familyId 存在时创建重复记录的问题
type: feedback
---

**问题**：
每次点击"整理家族故事"都调用 `/extract` API 重新分析，即使之前已经分析过。更严重的是，当 `familyId` 存在时，extract API 直接 INSERT 新记录，导致：
- 12 条 paths（重复 3 倍）
- 9 个 persons（重复 2-3 倍）
- story-timeline 页面显示大量重复条目

**根本原因**：
`/extract` 端点的数据库写入逻辑没有检查 `familyId` 是否已存在。即使传入 `familyId`，也只是跳过创建 `family_profiles`，但 `persons` 和 `migrations` 仍然直接 INSERT，没有 DELETE 旧记录。

**修复方案**：
在 `server.js` 的 `/extract` 端点中，当 `familyId` 存在时，先删除旧记录：

```javascript
if (!fid) {
  // 新建 family
  const fp = await db.query(...);
  fid = fp.rows[0].id;
} else {
  // ← 修复：重新分析时删除旧记录，避免重复
  log.db(`[extract] 重新分析，先删除旧数据 familyId=${fid}`);
  await db.query('DELETE FROM migrations WHERE family_id=$1', [fid]);
  await db.query('DELETE FROM persons WHERE family_id=$1', [fid]);
}
```

**数据库清理**：
手动清理测试家庭的重复数据：
```sql
DELETE FROM migrations WHERE family_id='f32d2da9-b5ff-4f03-9db0-c1be4eada9e6';  -- DELETE 12
DELETE FROM persons WHERE family_id='f32d2da9-b5ff-4f03-9db0-c1be4eada9e6';     -- DELETE 9
```

**与缓存优化的关系**：
- `mobile-chat.html` 的缓存优化（已有 familyId 则直接加载数据库）是**第一道防线**，避免不必要的 AI 调用
- 本修复是**第二道防线**，确保即使调用了 `/extract`，也不会产生重复数据
- 两者结合：缓存优化提升体验，DELETE 逻辑保证数据正确性

**如何应用**：
- 任何"重新分析"、"重新生成"场景，如果目标记录已存在，必须先 DELETE 再 INSERT
- 或使用 UPSERT 模式（`INSERT ... ON CONFLICT ... DO UPDATE`）
- 不要假设"每次分析都是首次"
