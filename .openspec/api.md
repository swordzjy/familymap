# API 规范

> 版本：1.0.0  
> 最后更新：2026-04-08

---

## 通用约定

### 响应格式

所有 API 端点返回 JSON 格式，成功响应包含 `success: true`，失败响应包含 `success: false` 和 `error` 字段。

```typescript
// 成功响应
{
  "success": true,
  "data": { ... }
}

// 失败响应
{
  "success": false,
  "error": "错误描述"
}
```

### SSE 流式响应

Agent 端点使用 Server-Sent Events (SSE) 流式推送：

```typescript
// text 事件（分块推送回复内容）
data: {"type":"text","content":"你好，我来帮你记录"}

// tool_call 事件（工具调用通知）
data: {"type":"tool_call","tool":"save_person"}

// done 事件（完成）
data: {"type":"done","isComplete":true,"familyId":"uuid"}

// error 事件（错误）
data: {"type":"error","message":"错误描述"}
```

---

## API 端点

### POST /amapapi/agent

**Agent 对话系统**（核心端点）

通过多轮对话收集家族迁徙历史，自动调用工具保存数据。

#### 请求

```json
{
  "messages": [
    {"role": "user", "content": "我住在北京市朝阳区"},
    {"role": "assistant", "content": "好的，请问你的祖籍是哪里？"}
  ],
  "familyId": "可选的家族 ID（续谈场景）"
}
```

#### 响应（SSE）

| 事件类型 | 字段 | 说明 |
|----------|------|------|
| `text` | `content` | AI 回复内容（分块推送） |
| `tool_call` | `tool` | 工具调用通知 |
| `done` | `isComplete`, `familyId` | 对话完成 |
| `error` | `message` | 错误信息 |

#### 工具调用时机

| 场景 | 工具 | 说明 |
|------|------|------|
| 用户确认某人信息 | `save_person` | 保存人物 |
| 用户提到搬迁 | `save_migration` | 保存迁徙 |
| 遇到模糊地名 | `geocode_and_verify` | 验证地名 |
| 用户提到年份 | `query_historical_context` | 查询历史 |
| 收集完成 | `mark_collection_complete` | 标记完成 |

---

### GET /amapapi/check-data

**数据健康检查**

检查数据库中数据的完整性和一致性。

#### 请求

无参数

#### 响应

```json
{
  "success": true,
  "summary": {
    "total_migrations": 17,
    "total_places": 17,
    "total_persons": 20,
    "total_families": 9,
    "total_issues": 22
  },
  "issues": {
    "missing_coords": [...],      // 缺少坐标的迁徙
    "orphan_migrations": [...],   // 孤立迁徙
    "orphan_places": [...],       // 孤立地点
    "orphan_persons": [...],      // 孤立人物
    "incomplete_families": [...]  // 不完整家族
  }
}
```

---

### POST /amapapi/fix-data

**数据自动修复**

自动修复缺失的地点引用数据。

#### 请求

无参数

#### 响应

```json
{
  "success": true,
  "result": {
    "created_places": [
      {"raw_name": "铁岭市", "id": "uuid", "type": "to_place"}
    ],
    "updated_migrations": [
      {"action": "linked_existing", "place": "哈尔滨", "type": "from_place"}
    ],
    "cleaned": [
      {"field": "from_place_id", "count": 5}
    ]
  }
}
```

---

### GET /amapapi/migration-map/:familyId

**获取家族迁徙地图数据**

用于前端地图可视化。

#### 请求

| 参数 | 类型 | 位置 | 必填 |
|------|------|------|------|
| `familyId` | UUID | 路径参数 | 是 |

#### 响应

```json
{
  "success": true,
  "familyName": "林家",
  "paths": [
    {
      "id": "uuid",
      "sequence_order": 1,
      "person_role": "祖父",
      "person_name": "林德福",
      "from_place": "黄县",
      "from_lng": 120.523,
      "from_lat": 37.640,
      "to_place": "营口",
      "to_lng": 122.235,
      "to_lat": 40.667,
      "year": 1890,
      "reason": "闯关东逃荒",
      "reason_type": "survival",
      "emotion_weight": "high"
    }
  ],
  "persons": [...],
  "historicalEvents": [...]
}
```

---

### GET /amapapi/demo-stories

**获取演示故事列表**

用于 `multi-stories.html` 页面展示预设的家族故事。

#### 响应

```json
{
  "success": true,
  "stories": [
    {
      "id": "uuid",
      "family_name": "林家",
      "title": "闯关东 (1890-1895)",
      "period": "清末",
      "stats": {
        "generations": 3,
        "years": 5,
        "cities": 3
      }
    }
  ]
}
```

---

### GET /amapapi/health

**健康检查**

检查服务状态。

#### 响应

```json
{
  "success": true,
  "status": "ok",
  "time": "2026-04-08T05:00:00.000Z",
  "db": true,
  "ai_key": true,
  "ai_url": "https://dashscope.aliyuncs.com",
  "amap_key": true,
  "model_chat": "qwen3.5-plus",
  "model_heavy": "qwen-max"
}
```

---

### POST /amapapi/save-edit/:familyId

**手动保存编辑**

允许用户手动修改已采集的数据。

#### 请求

```json
{
  "personId": "可选",
  "name": "可选",
  "role": "可选",
  "migrationId": "可选",
  "year": 1890,
  "fromPlace": "黄县",
  "toPlace": "营口",
  "reason": "逃荒"
}
```

---

### POST /amapapi/generate-story/:familyId

**生成家族故事**

基于已采集的数据生成叙事文本。

#### 响应

```json
{
  "success": true,
  "story": {
    "title": "林家：闯关东之路",
    "chapters": [...],
    "narration": "完整叙事文本"
  }
}
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | AI 服务不可用 |

---

## 限流

当前无硬性限流，但建议：

- Agent 对话：同一 `familyId` 间隔 ≥ 1 秒
- 数据检查：每小时 ≤ 10 次
- 数据修复：每小时 ≤ 5 次
