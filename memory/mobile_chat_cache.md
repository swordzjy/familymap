---
name: mobile-chat 缓存优化
description: 点击"整理家族故事"时，已有 familyId 则直接加载数据，跳过 AI 分析
type: feedback
---

**问题**：
每次点击"整理家族故事"都调用 `/extract` API 重新分析，即使之前已经分析过并有 familyId。这导致：
- 等待时间长（2-5 秒）
- 浪费 AI token 费用
- 用户体验差

**优化方案**：
1. **已有 familyId**：直接调用 `/migration-map/${familyId}` 获取数据（<1 秒）
2. **没有 familyId**：才调用 `/extract` API 进行分析（2-5 秒）
3. **新增"重新分析"按钮**：用户需要时可主动触发重新分析

**代码修改**：

```javascript
// goToStoryTimeline 函数
function goToStoryTimeline() {
  // 已有 familyId，直接加载数据（跳过分析）
  if (state.familyId) {
    loadExistingData(state.familyId);
    return;
  }
  // 首次分析，调用 extract API
  callExtractAPI();
}

// loadExistingData 函数（新增）
async function loadExistingData(familyId) {
  const response = await fetch(`${API_BASE}/migration-map/${familyId}`);
  const data = await response.json();
  sessionStorage.setItem('pending_chat_data', JSON.stringify({
    familyId, data, rawChatText: ''
  }));
  window.location.href = `/story-timeline.html?familyId=${familyId}`;
}

// reanalyzeData 函数（新增）
function reanalyzeData() {
  if (!confirm('确定要重新分析家族数据吗？')) return;
  sessionStorage.removeItem('pending_chat_data');
  callExtractAPI();  // 重新调用 AI 分析
}
```

**UI 变化**：
- 用户点击"我说完了"后，如果已有 familyId，显示"🔄 重新分析"按钮
- "整理家族故事"按钮文字根据状态变化：
  - 没有数据："正在解析家族数据..."
  - 已有数据："正在加载家族数据..."

**性能提升**：
- 首次分析：2-5 秒（需要 AI 分析）
- 后续查看：<1 秒（直接读取数据库）
- 节省 AI token 费用

**如何应用**：
- 用户首次聊天后点击"整理家族故事"会进行分析
- 之后每次查看都直接从数据库加载
- 如需重新分析（如 AI 识别错误），点击"🔄 重新分析"按钮
