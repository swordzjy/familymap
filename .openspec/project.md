# 家族迁徙平台 · 项目规范

> 版本：1.0.0  
> 最后更新：2026-04-08

## 项目概述

**寻根** - 家族迁徙故事采集与可视化平台

通过 AI 对话式交互收集用户家族迁徙历史，自动生成迁徙地图和时间线叙事。

### 核心价值

- 🎯 **对话式采集**：用户无需填写复杂表单，通过自然对话完成家族历史收集
- 🗺️ **地图可视化**：基于高德地图展示家族迁徙路径，支持 Bézier 曲线动画
- 📖 **故事化叙事**：结合历史事件背景，生成有温度的家族故事
- 🔍 **数据健康检查**：自动检测并修复数据完整性问题

---

## 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL 14+ (uuid-ossp, pg_trgm) |
| AI | 通义千问 (qwen3.5-plus) via Anthropic SDK 兼容 |
| 地图 | 高德地图 JS API v2.0 |
| 前端 | 纯 HTML/CSS/JS (无框架) |

### 目录结构

```
wangzu-map/
├── backend/
│   ├── server.js          # 主服务器（Agent 版）
│   ├── agents/            # Agent 相关模块
│   └── amap.js            # 高德地图客户端
├── frontend/public/
│   ├── index.html         # 入口页面
│   ├── mobile-chat.html   # 对话采集页面
│   ├── mobile.html        # 地图展示页面
│   ├── multi-stories.html # 多家族故事演示
│   ├── story-timeline.html# 故事时间线
│   └── data-tools.html    # 数据健康检查工具
├── sql/
│   ├── schema.sql         # 数据库建库脚本
│   ├── deploy.sql         # 完整部署脚本（可重复执行）
│   ├── multi-stories-data.sql  # 演示数据
│   └── check-and-fix-data.sql  # 数据检查修复脚本
└── .openspec/
    ├── project.md         # 本项目规范（本文件）
    ├── api.md             # API 规范
    ├── data.md            # 数据模型规范
    └── ui.md              # 前端页面规范
```

---

## 核心概念

### 数据模型关系

```
users (可选)
  └── family_profiles (家族档案)
        ├── persons (家族成员)
        │     └── migrations (迁徙事件)
        │           ├── from_place (地点)
        │           └── to_place (地点)
        ├── historical_events (历史事件库)
        ├── story_chapters (叙事章节)
        └── chat_sessions (对话会话)
```

### 迁徙类型 (reason_type)

| 类型 | 说明 | 颜色 |
|------|------|------|
| `survival` | 逃荒/生存 | 金色 #c8a96e |
| `war` | 战争避难 | 珊瑚色 #e07258 |
| `policy` | 政策驱动（三线建设等） | 青色 #3ec9a0 |
| `work` | 工作/事业发展 | 紫色 #a890e0 |
| `study` | 求学 | 蓝色 #6aabdc |
| `family` | 家庭团聚 | 青色 #3ec9a0 |
| `hope` | 返乡/希望 | 浅金色 #e8d098 |

### 代际 (generation)

- `0` = 本人
- `1` = 父辈
- `2` = 祖辈
- `-1` = 子女

---

## API 端点总览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/amapapi/agent` | POST | Agent 对话系统（核心） |
| `/amapapi/check-data` | GET | 数据健康检查 |
| `/amapapi/fix-data` | POST | 数据自动修复 |
| `/amapapi/migration-map/:familyId` | GET | 获取家族迁徙地图数据 |
| `/amapapi/demo-stories` | GET | 获取演示故事列表 |
| `/amapapi/health` | GET | 健康检查 |
| `/amapapi/save-edit/:familyId` | POST | 手动保存编辑 |
| `/amapapi/generate-story/:familyId` | POST | 生成家族故事 |

---

## Agent 工具系统

### 工具列表

| 工具名 | 触发时机 | 功能 |
|--------|----------|------|
| `save_person` | 用户确认某人信息 | 保存/更新人物 |
| `save_migration` | 用户提到搬迁 | 保存迁徙记录 |
| `geocode_and_verify` | 遇到模糊地名 | 验证地名坐标 |
| `query_historical_context` | 用户提到具体年份 | 查询历史背景 |
| `mark_collection_complete` | 收集到 3 代 + 完整迁徙 | 标记采集完成 |

### 工具调用流程

```
用户消息 → Agent Loop → LLM 判断 → 工具执行 → 结果返回 → 继续对话
                                    ↓
                              数据库持久化
```

---

## 前端页面规范

### 设计系统

#### 颜色变量

```css
:root {
  /* 深色主题（地图页面） */
  --night: #090806;
  --ink0: #110f0b;
  --gold: #c8a96e;
  --gold2: #e8d098;
  --cream: #eee8d8;
  
  /* 迁徙路径颜色 */
  --purple: #a890e0;
  --teal: #3ec9a0;
  --coral: #e07258;
  --blue: #6aabdc;
}
```

#### 字体栈

```css
--serif: 'Noto Serif SC', serif;   /* 标题/叙事 */
--mono: 'DM Mono', monospace;       /* 元数据/年份 */
--sans: 'DM Sans', sans-serif;      /* 正文/UI */
```

### 页面清单

| 页面 | 用途 | 关键功能 |
|------|------|----------|
| `mobile-chat.html` | 对话采集 | SSE 流式对话、引导式问题 |
| `mobile.html` | 地图展示 | Bézier 曲线动画、城市标记 |
| `multi-stories.html` | 多故事演示 | 家族切换、路径聚焦 |
| `story-timeline.html` | 时间线叙事 | 历史事件关联、章节播放 |
| `data-tools.html` | 数据工具 | 健康检查、自动修复 |

---

## 数据质量标准

### 完整性检查

1. **迁徙记录**：必须有 `from_place_id` 和 `to_place_id`
2. **地点数据**：必须有 `longitude` 和 `latitude`
3. **人物记录**：至少与一次迁徙关联
4. **家族档案**：至少 2 个人物 + 1 次迁徙

### 修复策略

- 缺失地点 ID → 根据 `raw_name` 创建或关联已有地点
- 空字符串 ID → 清理为 NULL 后修复
- 孤立数据 → 标记但不删除（可能需要保留）

---

## 部署说明

### 环境要求

- Node.js 18+
- PostgreSQL 14+
- 高德地图 API Key
- 阿里云 DashScope API Key

### 快速启动

```bash
# 1. 创建数据库
createdb -U postgres family_migration

# 2. 执行建库脚本
psql -U postgres -d family_migration -f sql/deploy.sql

# 3. 安装依赖
cd backend && npm install

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 配置 DB_*, AMAP_KEY, DASHSCOPE_API_KEY

# 5. 启动服务
node server.js

# 6. 访问应用
open http://localhost:3005
```

### 数据检查

```bash
# SQL 方式
psql -U postgres -d family_migration -f sql/check-and-fix-data.sql

# Web 方式
open http://localhost:3005/data-tools.html

# API 方式
curl http://localhost:3005/amapapi/check-data
curl -X POST http://localhost:3005/amapapi/fix-data
```

---

## 相关文档

- [API 规范](./api.md) - 详细 API 端点文档
- [数据模型](./data.md) - 数据库表结构详解
- [前端规范](./ui.md) - 页面组件与交互规范

---

## 变更日志

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-04-08 | 1.0.0 | 初始版本，基于现有代码结构生成 |
