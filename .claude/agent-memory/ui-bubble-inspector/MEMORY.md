# UI Bubble Inspector Memory

## 用户设计偏好

- **弹幕飘窗**：用户明确选择弹幕式横向自动滚动，而非横向手动滚动或垂直堆叠
- **节省空间**：弹幕容器高度 88px，3 条轨道，不占用聊天窗口空间
- **交互模式**：点击填充输入框，不自动发送，让用户有编辑机会
- **视觉风格**：金色/奶白/茶绿三色轮转，圆角 20px，金色边框，5px 小圆点前缀

## 已验证样式参数

```css
.guidance-cards {
  height: 88px;
  overflow: hidden;
}

.danmaku-item[data-track="0"] { top: 4px; }
.danmaku-item[data-track="1"] { top: 32px; }
.danmaku-item[data-track="2"] { top: 60px; }

@keyframes danmakuFly {
  from { transform: translateX(110vw); }
  to { transform: translateX(-110%); }
}
```

## Chrome 修复关键 (2026-04-09)

**问题**：弹幕在 Chrome 中不显示

**根因**：仅靠 CSS animation 的 `transform: translateX(110vw)` 作为起点，Chrome 对 `position: absolute` + `transform` 的渲染方式不同

**修复**：在 `fire()` 函数中明确设置 `left` 起始位置：

```javascript
// fire() 函数 行 1040-1043
el.style.top        = `${track * 29 + 4}px`;
el.style.left       = `${stageW + 8}px`;  // ← 关键：明确设置起始位置
el.style.visibility = 'visible';
el.style.animation  = `danmakuFly ${durSec.toFixed(2)}s linear forwards`;
```

**原理**：`left` 控制绝对定位的起始位置，`animation` 通过 `transform` 控制相对位移。

## 已验证功能 (2026-04-09)

| 检查项 | 状态 | 实际值 |
|--------|------|--------|
| `.guidance-cards` 容器存在 | ✅ | height: 88px, overflow: hidden |
| `.danmaku-stage` 存在 | ✅ | position: absolute |
| 左右渐变遮罩 | ✅ | ::before / ::after 28px 宽 |
| 弹幕从右向左飞入 | ✅ | translateX(110vw) → -110% |
| 3 条轨道 | ✅ | top: 4px / 32px / 60px |
| 点击填充输入框 | ✅ | 不自动发送 |
| 触摸暂停动画 | ✅ | .paused 类切换 |
| 气泡圆角 20px | ✅ | padding: 7px 14px |
| 小圆点前缀 | ✅ | 5px, 金色/奶白/茶绿 |
| 文字 13px serif | ✅ | font-family: var(--serif) |

## 已知问题

无

## MCP 配置

Playwright MCP 通过 Claude Code 内置插件可用，权限配置在 `.claude/settings.local.json`：
- `mcp__plugin_playwright_playwright__browser_run_code`

无需额外安装 `@playwright/mcp` 包。
