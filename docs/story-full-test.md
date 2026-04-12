# 完整故事功能测试指南

## 新功能说明

新增了「完整故事」功能，基于所有章节数据，AI 创作一篇连贯的叙事文章。

## API 端点

### 1. POST /amapapi/generate-full-story/:familyId
生成完整故事

**请求示例：**
```bash
curl -X POST 'http://localhost:3005/amapapi/generate-full-story/1df5a6b8-a833-445d-803c-8afdb6320492' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**响应示例：**
```json
{
  "success": true,
  "output_id": "xxx-uuid",
  "version": 1,
  "title": "周府家族故事",
  "word_count": 4200,
  "chapters_indexed": 7,
  "merged_groups": 2,
  "duration_sec": 45
}
```

### 2. GET /amapapi/story-output/:familyId
获取完整故事输出

**请求示例：**
```bash
curl -s 'http://localhost:3005/amapapi/story-output/1df5a6b8-a833-445d-803c-8afdb6320492?version=latest&type=full_story'
```

**响应示例：**
```json
{
  "success": true,
  "exists": true,
  "output": {
    "id": "xxx",
    "title": "周府家族故事",
    "prose": "完整的散文体叙事...",
    "chapter_index": [...],
    "word_count": 4200,
    "merged_groups": "[...]",
    "created_at": "2026-04-12T..."
  }
}
```

## 前端测试页面

访问：`http://localhost:3005/story-full.html?familyId=1df5a6b8-a833-445d-803c-8afdb6320492`

功能：
1. 自动检测是否有完整故事
2. 无故事时显示空状态和生成按钮
3. 生成完成后展示完整故事
4. 支持重新生成
5. 显示合并章节标识（👥）

## 核心特性

### 1. 夫妻共同经历自动整合
AI 会检测到：
- 同一年份（±1 年）
- 相同路线（从 A 到 B）
- 有家庭关系（夫妻、父子等）

的多个章节，并在完整故事中使用"他们"的视角进行整合叙述。

### 2. 章节索引
每个章节在完整故事中的位置会被记录：
- sequence: 章节序号
- title: 章节标题
- year: 年份
- participants: 参与者
- emotion_tags: 情绪标签
- start_pos/end_pos: 在 prose 中的位置

### 3. 数据来源
- 保持 `story_chapters` 表不变（便于单章修改）
- 完整故事存入 `story_outputs` 表
- 支持多版本并存（version 递增）

## 测试步骤

1. **确认数据库已就绪**
```bash
curl http://localhost:3005/amapapi/health
```

2. **访问测试页面**
```
http://localhost:3005/story-full.html?familyId=1df5a6b8-a833-445d-803c-8afdb6320492
```

3. **点击生成完整故事**
- 等待 30-60 秒
- AI 创作完成后自动展示

4. **验证整合效果**
- 检查是否有 👥 合并章节标识
- 阅读叙事是否连贯流畅
- 夫妻共同经历是否用"他们"叙述

## 文件清单

| 文件 | 说明 |
|------|------|
| `sql/add-story-outputs-table.sql` | 数据库迁移脚本 |
| `backend/server.js` | 新增 API 和辅助函数 |
| `frontend/public/story-full.html` | 完整故事视图页面 |
| `docs/story-full-test.md` | 本测试文档 |

## 下一步优化

- [ ] 支持版本切换（v1, v2, v3...）
- [ ] 添加导出 PDF 功能
- [ ] 支持手动编辑完整故事
- [ ] 添加分享功能
