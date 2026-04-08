---
name: 生产环境 VARCHAR 错误修复
description: AI 返回的 reason_type 可能不是预定义枚举值导致数据库报错
type: feedback
---

**问题：** 生产环境报 `value too long for type character varying(10)` 错误

**根因：** AI 模型可能返回非预定义的 `reason_type` 值（如长字符串），而不是枚举值 `study|work|war|disaster|assignment|family|unknown`

**修复方案：** 在所有数据入库点添加验证和清理
```javascript
const VALID_REASON_TYPES = ['study', 'work', 'war', 'disaster', 'assignment', 'family', 'unknown'];
const sanitizedReasonType = VALID_REASON_TYPES.includes(reason_type) ? reason_type : 'unknown';
```

**涉及位置：**
1. `/amapapi/agent` - `save_migration` 工具调用
2. `/amapapi/extract` - 结构化抽取端点

**教训：** 永远不要信任 AI 返回的枚举值，必须在后端验证

---
