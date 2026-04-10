---
name: mobile.html 近期改动记录
description: mobile.html 所有未归档改动的完整记录，防止重复修改
type: project
---

## mobile.html 近期改动记录 (2026-04-10)

> 每次改动前必须对照此表，避免重复修改。

---

### 1. 地图渲染统一 (multi-stories → mobile)
- `generateCurve` → `bezierPoints` (返回 AMap.LngLat 数组)
- `buildStoryFromPaths` 构建 cities + routes 结构
- `fitStoryBoundsWithCurves` 替代 setFitView
- `startSequence` 基于 `idx * 5500` 的定时动画序列
- `drawPolylineAnimate` 逐步绘制 polyline
- 事件卡片替换为 multi-stories 紧凑样式

### 2. 城市标记美化
- `createCityMarkerEl` 圆点更大 (16px/22px)
- 双层光晕 + 径向渐变
- 终点 pulse 动画

### 3. 城市点击详情
- `openCityPop(city, cityIndex, story)` 弹窗显示该城市关联的所有迁徙

### 4. 数据完整性报告 (左下角)
- `showCoordWarn` 收集 5 类问题：坐标/时间/人物/原因/地点
- 简洁描述格式：「起点无坐标」「年份未知」「未关联人物」「原因未记录」「地名为空」
- **数据完整时显示绿色徽章** ✓ 数据完整，点击不展开面板
- **数据不完整时显示红色徽章** ⚠ N 条数据不完整，点击展开面板
- `toggleDataWarn()` 检查 `.complete` class，完整时直接返回
- badge 始终可见，面板内 `event.stopPropagation()` 防止冒泡关闭
- 删除关闭按钮 (×)，无 closeDataWarn/hideCoordWarn 函数

### 8. 城市弹窗(city-pop)优化 (最新)
- 宽度从 340px 改为 50%（`min-width:280px`）
- 从居中定位改为左侧固定定位 (`left:16px`)
- 内容自动折行滚动 (`overflow:hidden` + `.cp-body` 内滚动)
- 支持拖拽移动 (`initCityPopDrag()`)，鼠标+触屏
- 关闭按钮 (`cp-close`) 已存在，点击 × 关闭
- 拖拽时关闭按钮不触发

### 5. 迁徙线段排序 (最新)
- `buildStoryFromPaths` 排序规则：
  1. 本人的迁徙最先显示
  2. 其余按 generation 降序（长辈优先）
  3. 同一人内按年份升序

### 6. 事件卡片三行布局 (最新)
- 第一行：`角色`（金色）: `从A迁往B`
- 第二行：`名字`（白色加粗）: `事件描述`
- 第三行：`年份` → `路线`（底部渐变条，保持不变）

### 7. 事件卡片可拖拽 (最新)
- `initEventDrag()` IIFE 支持鼠标 + 触屏
- 底部路线区不触发拖拽
- 拖拽后从居中切换为绝对定位

---

## 修改前检查清单

每次修改 mobile.html 前，对照以上列表确认：
- [ ] 这个改动是否已在列表中？
- [ ] 是否已被后续改动覆盖？
- [ ] 是否引用了已删除的函数/样式？
