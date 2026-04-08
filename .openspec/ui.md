# 前端页面规范

> 版本：1.0.0  
> 最后更新：2026-04-08

---

## 设计系统

### 主题色

#### 深色主题（地图页面）

```css
:root {
  --night: #090806;        /* 主背景 */
  --ink0: #110f0b;         /* 次要背景 */
  --ink1: #1a1710;
  --ink2: #232018;
  
  --gold: #c8a96e;         /* 主强调色 */
  --gold2: #e8d098;        /* 浅金色 */
  --cream: #eee8d8;        /* 文本色 */
  
  --mist: rgba(238,232,216,0.5);   /* 半透明蒙版 */
  --mist2: rgba(238,232,216,0.25);
  --mist3: rgba(238,232,216,0.1);
  --mist4: rgba(238,232,216,0.05);
}
```

#### 迁徙路径颜色

| 类型 | 颜色 | 使用场景 |
|------|------|----------|
| `--purple` | #a890e0 | 工作/事业发展 |
| `--teal` | #3ec9a0 | 政策驱动/家庭 |
| `--coral` | #e07258 | 战争避难 |
| `--blue` | #6aabdc | 求学 |

### 字体栈

```css
--serif: 'Noto Serif SC', serif;   /* 标题、叙事文本 */
--mono: 'DM Mono', monospace;       /* 元数据、年份、数字 */
--sans: 'DM Sans', sans-serif;      /* 正文、UI 文本 */
```

### 间距系统

基于 4px 网格：

- `4px` - 最小间距
- `8px` - 紧凑间距
- `12px` - 标准间距
- `16px` - 大间距
- `20px` - 超大间距
- `24px` - 区块间距

### 圆角规范

- `4px` - 小徽章、小按钮
- `6px` - 卡片内部元素
- `8px` - 输入框
- `10px` - 小型卡片
- `12px` - 标准卡片
- `18px` - 大卡片、芯片

---

## 页面清单

### mobile-chat.html

**对话采集页面**（移动端优先）

#### 功能
- SSE 流式对话
- 引导式问题卡片
- 快捷操作栏
- 地图预览入口

#### 关键组件

```html
<!-- 顶部导航 -->
<div class="nav-bar">
  <div class="nav-title">寻根</div>
  <div class="nav-actions">...</div>
</div>

<!-- 消息列表 -->
<div class="messages">
  <div class="message ai">
    <div class="bubble">...</div>
  </div>
  <div class="message user">
    <div class="bubble">...</div>
  </div>
</div>

<!-- 引导式问题卡片 -->
<div class="guidance-cards">...</div>

<!-- 输入区域 -->
<div class="input-area">
  <textarea id="chat-input">...</textarea>
</div>
```

#### API 交互

```javascript
// POST /amapapi/agent
const eventSource = new EventSource('/amapapi/agent', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, familyId })
});

eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // data.type: 'text' | 'tool_call' | 'done' | 'error'
};
```

---

### mobile.html

**地图展示页面**

#### 功能
- 高德地图集成
- Bézier 曲线动画
- 城市标记点击
- 迁徙序列播放

#### 关键组件

```html
<!-- 顶部标题 -->
<div class="top-bar">
  <div class="map-title">家族迁徙地图</div>
  <div class="map-subtitle">3 段迁徙 · 4 个城市</div>
</div>

<!-- 地图容器 -->
<div id="amap-container"></div>

<!-- 底部图例 -->
<div class="bottom-bar">
  <div class="legend-title">迁徙原因</div>
  <div class="legend-items">...</div>
</div>
```

#### 地图配置

```javascript
AMapLoader.load({
  key: 'YOUR_KEY',
  version: '2.0',
  plugins: ['AMap.Polyline', 'AMap.Marker'],
  serviceHost: 'https://f.aifeisu.cn/_AMapService',
});

const map = new AMap.Map('amap-container', {
  zoom: 5,
  center: [113.0, 38.0],
  mapStyle: 'amap://styles/dark',
});
```

#### 动画序列

1. 起点标记出现（透明度 0→1）
2. 事件卡片显示
3. Bézier 曲线绘制（4 秒）
4. 终点标记出现
5. 4 秒后卡片隐藏，继续下一段

---

### multi-stories.html

**多家族故事演示页面**

#### 功能
- 故事选择器（横向滚动）
- 家族迁徙路径展示
- 路线芯片聚焦
- 事件卡片固定显示

#### 布局

```
┌─────────────────────────────┐
│ 返回 | 家族迁徙故事集        │ 导航栏
├─────────────────────────────┤
│ [林家] [陈家] [赵家] [周家]  │ 故事选择器
├─────────────────────────────┤
│                             │
│         地图区域             │
│                             │
│  ┌─────────────┐            │
│  │ 事件卡片    │ ← 左上角    │
│  └─────────────┘            │
│                             │
│  家族迁徙路径 · 3 段          │
│  [→ 营口 1890] [→ 哈尔滨 1895]│ 路线芯片
└─────────────────────────────┘
```

#### 关键函数

```javascript
// 故事选择
function selectStory(idx) {
  currentStoryIndex = idx;
  renderStorySelector();
  renderMapContent();
}

// 聚焦路线
function focusRoute(idx) {
  const route = story.routes[idx];
  const cityFrom = story.cities[route.from];
  const cityTo = story.cities[route.to];
  
  // 计算合适的 zoom 级别
  const maxDiff = Math.max(
    Math.abs(cityFrom.lng - cityTo.lng),
    Math.abs(cityFrom.lat - cityTo.lat)
  );
  const zoom = maxDiff > 20 ? 4 : maxDiff > 15 ? 5 : ...;
  
  amapInstance.setZoomAndCenter(zoom, [midLng, midLat], false, 800);
  
  // 重绘单条路线动画
  drawPolylineAnimate(path, route, 2000);
}
```

---

### story-timeline.html

**故事时间线页面**

#### 功能
- 垂直时间线布局
- 历史事件关联
- 章节叙事播放

#### 布局

```html
<div class="timeline-container">
  <div class="timeline-item" data-year="1890">
    <div class="timeline-marker"></div>
    <div class="timeline-content">
      <div class="year-label">1890</div>
      <div class="event-title">举家闯关东</div>
      <div class="event-desc">...</div>
    </div>
  </div>
</div>
```

---

### data-tools.html

**数据健康检查工具**

#### 功能
- 数据概览统计
- 问题分类展示
- 自动修复执行

#### 检查项目

| 类型 | 说明 | 修复方式 |
|------|------|----------|
| 缺少坐标 | `from_place_id` / `to_place_id` 为 NULL | 创建地点并关联 |
| 孤立迁徙 | 引用不存在的地点 ID | 清理或重新关联 |
| 孤立地点 | 无迁徙引用 | 保留（可能需要） |
| 孤立人物 | 无迁徙记录 | 保留（可能是新增） |
| 不完整家族 | <2 人或 0 迁徙 | 提示补充 |

---

## 组件规范

### 消息气泡 (mobile-chat.html)

```css
.message {
  display: flex;
  padding: 12px 16px;
  gap: 12px;
}

.message.ai {
  background: var(--ink0);
}

.message.user {
  background: var(--gold);
  color: var(--night);
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 16px;
  line-height: 1.6;
}
```

### 迁徙芯片 (multi-stories.html)

```css
.chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid var(--mist4);
  background: rgba(17,15,11,0.6);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip.on {
  border-color: var(--gold);
  background: var(--mist4);
}

.chip-d {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: currentColor;
}
```

### 事件卡片 (multi-stories.html)

```css
.migration-event {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 280px;
  padding: 10px 14px;
  background: rgba(9,8,6,0.95);
  border: 1px solid rgba(200,169,110,0.25);
  border-radius: 10px;
}

.event-year {
  font-size: 11px;
  color: var(--gold);
  display: inline-block;
  padding: 2px 6px;
  background: rgba(200,169,110,0.1);
  border-radius: 4px;
}

.event-route {
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  background: linear-gradient(135deg, 
    rgba(200,169,110,0.12), 
    rgba(200,169,110,0.04)
  );
  border-radius: 6px;
}
```

---

## 响应式设计

### 断点

| 断点 | 宽度 | 适用设备 |
|------|------|----------|
| Mobile | < 768px | 手机 |
| Tablet | 768px - 1024px | 平板 |
| Desktop | > 1024px | 桌面 |

### 移动端优化

```css
/* 安全区域适配 (iPhone 刘海) */
padding-top: calc(10px + env(safe-area-inset-top));
padding-bottom: calc(10px + env(safe-area-inset-bottom));

/* 触摸目标最小 44x44px */
.btn, .chip, .action {
  min-height: 44px;
  min-width: 44px;
}

/* 禁止缩放 */
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
```

---

## 性能优化

### 地图优化

- 使用 `strokeOpacity: 0` 初始隐藏路径
- 按需创建 polyline（不在 DOM 中预存）
- Bézier 曲线点数为 60（平衡平滑度和性能）

### SSE 优化

- 分块推送文本（每 15 字一帧）
- 使用 `Cache-Control: no-cache`
- 错误重连机制

### 资源加载

- 字体使用 Google Fonts（子集化）
- 地图 SDK 异步加载
- CSS 内联关键样式

---

## 变更日志

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-04-08 | 1.0.0 | 初始版本，基于现有页面整理 |
