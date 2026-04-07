---
name: 移动端页面流程和返回链接
description: 移动端三页面流程顺序和返回链接的正确跳转目标
type: feedback
---

**移动端页面流程**：
```
mobile-chat.html (聊天收集家族故事)
    ↓ 点击"整理家族故事"
story-timeline.html (确认/编辑迁徙数据)
    ↓ 点击"生成迁徙地图"
mobile.html (地图动画展示)
    ↓ 点击"返回故事时间线"
story-timeline.html (返回确认页面)
```

**为什么这样设计**：
- 用户在 mobile.html 查看地图后，可能需要返回 story-timeline.html 编辑或确认迁徙数据
- 直接返回 mobile-chat.html 会跳过数据确认环节，流程不完整
- 保持原路返回的原则，让用户可以逐步回退

**修改内容**：
1. mobile.html 底部按钮文字从"返回聊天页面"改为"返回故事时间线"
2. 链接从 `/mobile-chat.html` 改为 `/story-timeline.html?familyId=${familyId}`
3. 在 `renderUserPaths` 函数中动态设置 href，确保 familyId 正确传递

**如何应用**：
- 未来修改 mobile.html 导航时，保持返回 story-timeline.html 的逻辑
- 不要直接跳回 mobile-chat.html，除非用户明确需要清除数据重新开始
