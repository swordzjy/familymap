# 我的一生 · 快速启动指南

## 项目结构

```
family-migration-demo/
├── sql/
│   └── schema.sql          ← PostgreSQL 建库语句（含历史事件预置数据）
├── backend/
│   ├── server.js           ← Express API 服务
│   ├── amap.js             ← 高德地图工具集
│   ├── package.json
│   └── .env.example        ← 环境变量模板
└── frontend/
    └── public/
        └── index.html      ← 完整前端（对话+地图+故事播放器）
```

---

## 第一步：准备 API Keys

### 1. Anthropic API Key
访问 https://console.anthropic.com → API Keys → 创建

### 2. 高德地图 API Keys（v4 安全版，需要两个 Key + 一个安全密钥）

访问 https://lbs.amap.com → 控制台 → 应用管理 → 创建应用

**第一步**：创建应用后，在应用内添加两种 Key：

| Key 类型 | 用途 | 填写位置 |
|---------|------|---------|
| Web 服务 API | 后端地理编码调用 | `.env` 的 `AMAP_KEY` |
| Web 端 (JS API) | 前端地图渲染 | `index.html` 的 `AMapLoader.load({ key: })` |

**第二步**：获取安全密钥（jscode）
- 高德控制台 → 应用详情 → 安全密钥（右侧复制按钮）
- 填入 `.env` 的 `AMAP_JSCODE`
- 填入 `nginx.conf` 的 `YOUR_JSCODE`（Nginx 代理注入，前端不持有）

**v4 安全机制说明**：
- 前端地图渲染请求 → Nginx `/_AMapService/` 代理 → Nginx 注入 jscode → 高德服务器
- 后端地理编码调用 → 直接携带 key + jscode → 高德服务器（服务端安全）
- 用户在浏览器中看不到 jscode，防止 key 滥用

---

## 第二步：初始化数据库

```bash
# 1. 创建数据库
psql -h localhost -U aifeisu -c "CREATE DATABASE family_migration;"

# 2. 执行建库语句（包含历史事件预置数据）
psql -h localhost -U aifeisu -d family_migration -f sql/schema.sql

# 3. 验证
psql -h localhost -U aifeisu -d family_migration -c "SELECT COUNT(*) FROM historical_events;"
# 应输出 16（预置了16条历史事件）
```

---

## 第三步：配置高德 v4 代理

**方案 A：Nginx 代理（推荐生产环境）**

```bash
# 编辑 nginx.conf，将 YOUR_JSCODE 替换为你的安全密钥
vim nginx.conf

# 复制到 Nginx 配置目录
cp nginx.conf /etc/nginx/sites-available/family-migration
ln -s /etc/nginx/sites-available/family-migration \
      /etc/nginx/sites-enabled/

# 验证并重载
nginx -t && nginx -s reload
```

**方案 B：Node.js 代理中间件（本地开发快速方案）**

```bash
cd backend
npm install http-proxy-middleware
```

然后在 `server.js` 顶部 `app.use(cors())` 之后添加（`nginx.conf` 底部注释里有完整代码）。

完成代理配置后，在 `index.html` 的 `AMapLoader.load()` 里**取消注释** `serviceHost` 那一行：

```javascript
// 取消注释这一行：
serviceHost: '/_AMapService',
```

## 第四步：启动后端

```bash
cd backend

# 1. 复制环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Keys 和数据库配置

# 2. 安装依赖
npm install

# 3. 启动
npm run dev   # 开发模式（自动重启）
# 或
npm start     # 生产模式

# 服务启动后访问: http://localhost:3001
```

---

## 第五步：启动前端

```bash
# 后端已配置 express.static，访问 http://localhost:3001 即可
# 或独立静态服务：
cd frontend/public && npx serve .
```

**v4 配置核对清单**（打开 `index.html` 确认以下两处）：

```javascript
// 1. AMapLoader.load 中填入你的 JS API Key
AMapLoader.load({
  key: 'YOUR_AMAP_JS_KEY',   // ← 替换这里
  ...
  // 2. 配置代理后取消注释 serviceHost
  // serviceHost: '/_AMapService',  // ← 取消注释
})
```

---

## 完整使用流程

1. 访问 http://localhost:3001
2. 在左侧对话框与 AI 对话，讲述家族故事
3. 对话收集完成后（约5-8轮），出现「生成家族迁徙地图」按钮
4. 点击按钮，等待 AI 解析（约10-15秒）
5. 右侧地图显示迁徙路径动画
6. 底部故事播放器按章节讲述家族叙事

---

## Demo 模式（无需 API Key）

如果没有 API Key，前端仍可运行 Demo：
- 使用预置的家族数据（你爷爷的故事）
- 地图用灰色背景替代高德地图
- 故事播放器使用预置章节

直接在浏览器打开 `frontend/public/index.html`，
在对话框输入任意内容，点击发送后会出现「生成」按钮，
点击后自动进入 Demo 模式。

---

## API 接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 对话式信息采集（流式SSE） |
| POST | `/api/extract` | 抽取结构化家族数据 |
| GET  | `/api/migration-map/:id` | 获取迁徙路径数据 |
| POST | `/api/generate-story/:id` | 生成叙事章节 |
| GET  | `/api/geocode?place=地名` | 单独地理编码接口 |

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS + 高德地图 JS API v2.0 |
| 后端 | Node.js + Express |
| AI 对话 | Anthropic Claude claude-sonnet-4-6（流式） |
| 地理编码 | 高德地图 Web 服务 API |
| 数据库 | PostgreSQL 14+ |
| 部署 | 本地开发，可直接部署至 Vercel/Railway |

---

## 下一步扩展

- [ ] 接入 Mapbox 获得更精美的地图样式
- [ ] 添加语音输入（Whisper API）
- [ ] 家族树节点编辑器
- [ ] 迁徙地图海报导出（html2canvas）
- [ ] 多用户家族协作（WebSocket）
- [ ] 历史事件详情弹窗