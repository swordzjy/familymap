---
name: story-timeline 可编辑和滚动音效
description: story-timeline.html 所有条目都可编辑，移动端快速滚动时有声音提示
type: feedback
---

**修改内容**：

1. **所有条目都可编辑**
   - 原来只有"不完整"事件才显示编辑表单
   - 现在所有事件（完整和不完整）都可以编辑
   - 完整事件显示"✏️ 编辑"按钮
   - 不完整事件显示缺失信息提示和"点击编辑"

2. **移动端滚动声音反馈**
   - 类似 iOS 日历 App 的滚动"哒哒"声
   - 仅在移动端（iPhone/iPad/Android）启用
   - 快速滚动时触发（scrollVelocity > 2）
   - 使用 Web Audio API 生成短促的 800Hz 正弦波
   - 首次触摸时初始化音频上下文

3. **新增函数**
   - `toggleEditForm(pathId)` - 切换编辑表单显示/隐藏
   - `initAudio()` - 初始化音频上下文
   - `playScrollSound()` - 播放滚动"哒"声
   - IIFE 滚动监听器 - 监听移动端滚动并触发声音

**技术实现**：
```javascript
// 滚动声音反馈（仅移动端）
(function() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;
  
  // 监听滚动，快速滚动时播放"哒"声
  contentEl.addEventListener('scroll', function() {
    if (scrollVelocity > 2 && timeDiff > 50) {
      playScrollSound();
    }
  }, { passive: true });
})();
```

**如何应用**：
- 保持编辑功能对所有事件开放，无论信息是否完整
- 滚动声音仅在移动端生效，桌面端不受影响
- 音频上下文在首次触摸时初始化（浏览器要求用户交互后才能播放声音）
