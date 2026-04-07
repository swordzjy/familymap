---
name: 迁徙事件同步显示实现
description: 在地图路径动画绘制过程中同步显示事件卡片的实现方式
type: reference
---

**实现位置**：frontend/public/xungen_v3.html

**核心代码**：

1. **showEvent 函数**（第 833-845 行）：
```javascript
function showEvent(routeIndex){
  const route = ROUTES[routeIndex];
  if(!route) return;
  const eventEl = document.getElementById('migration-event');
  document.getElementById('event-year').textContent = route.year;
  document.getElementById('event-title').textContent = route.event;
  document.getElementById('event-desc').textContent = route.desc;
  eventEl.classList.add('visible');
  setTimeout(() => { eventEl.classList.remove('visible'); }, 4000);
}
```

2. **SEQ 动画序列**（第 810-821 行）- 每个 drawPolyline 前插入 showEvent：
```javascript
const SEQ = [
  [0,    ()=> fadeMarker(markers[0])],   // 起点出现
  [1800, ()=> showEvent(0)],             // 显示事件
  [2000, ()=> drawPolyline(polylines[0], 3500)], // 绘制路径
  // ... 后续同理
];
```

3. **ROUTES 数据**（第 663-667 行）- 包含事件元数据：
```javascript
const ROUTES = [
  { from:0, to:1, year:'1960s', event:'父亲考入清华大学', desc:'...' },
  { from:1, to:2, year:'1970', event:'毕业分配下乡', desc:'...' },
  { from:2, to:1, year:'1992', event:'返回北京工作', desc:'...' },
];
```

**迁移到 index.html 时**：
- 复用 showEvent 函数逻辑
- 事件数据来自后端 API 返回的 mapData.paths
- 在 startDemoAnimation() 或 generateMap() 中调用
