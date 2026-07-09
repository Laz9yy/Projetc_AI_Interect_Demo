# Bug 修复报告

> 生成日期: 2026-07-09
> 项目: mindchat-live2d
> 问题: 用户输入文字后文本框无显示，AI 不会对话

---

## Bug 1 (P0) — Zustand `set` 回调中直接修改消息对象引用

**文件**: `src/store/chatStore.ts`

**位置**: 第 81-88 行（AI 流式模式）和第 120-127 行（离线模拟模式）

**问题描述**:
在 Zustand 的 `set` 回调中，从 `s.messages` 获取的 `lastMsg` 是同一个对象引用，然后直接 `lastMsg.content += chunk.text` 原地修改了该对象。虽然 `messages` 数组是新创建的（`[...s.messages]`），但 React 组件接收到的 `message` prop 对象引用未变，可能导致 React 跳过渲染更新。

**影响**: 这是导致"用户消息不显示、AI 不对话"的最可能原因。流式更新的文本不会实时反映到 UI 上。

**修复方案**:

```typescript
// 修复前 (chatStore.ts 第 81-88 行)
set((s) => {
  const msgs = [...s.messages];
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg && lastMsg.id === aiMsgId) {
    lastMsg.content += chunk.text;
    lastMsg.isTyping = false;
  }
  return { messages: msgs };
});

// 修复后 — 使用不可变更新
set((s) => {
  const msgs = s.messages.map((msg) => {
    if (msg.id === aiMsgId) {
      return { ...msg, content: msg.content + chunk.text, isTyping: false };
    }
    return msg;
  });
  return { messages: msgs };
});
```

同样需要修复离线模拟分支（约第 120-127 行）:

```typescript
// 修复前
set((s) => {
  const msgs = [...s.messages];
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg && lastMsg.id === aiMsgId) {
    lastMsg.content += chunk.text;
    lastMsg.isTyping = false;
  }
  return { messages: msgs };
});

// 修复后
set((s) => {
  const msgs = s.messages.map((msg) => {
    if (msg.id === aiMsgId) {
      return { ...msg, content: msg.content + chunk.text, isTyping: false };
    }
    return msg;
  });
  return { messages: msgs };
});
```

---

## Bug 2 (P0) — AI 流式模式下表情切换逻辑死代码

**文件**: `src/store/chatStore.ts`

**位置**: 第 68-107 行

**问题描述**:
第 78 行 `lastExpr = chunk.expression` 更新了 `lastExpr` 变量，但第 95-96 行又读取 `expr = chunk.expression` 后比较 `expr !== lastExpr`。由于两者值相同，此条件永远为 `false`，AI 流式模式下的表情切换代码从未执行。

**影响**: AI 回复期间角色表情无法跟随内容变化，永远停留在初始的 `thinking` 表情。

**修复方案**:

```typescript
// 修复前 (约第 68-107 行)
let lastExpr = 'neutral';

if (settings.isConfigured) {
  for await (const chunk of stream) {
    lastExpr = chunk.expression;  // ← 第78行

    // ... 更新消息内容 ...

    if (debounceTimer !== null) continue;

    const expr = chunk.expression;
    if (expr !== lastExpr) {  // ← 永远为 false
      // ... 表情切换代码 ...
    }
  }
}

// 修复后 — 去掉第78行的提前赋值，或改为只在防抖窗口后更新
let lastExpr = 'neutral';
let currentExpr = 'neutral';

if (settings.isConfigured) {
  for await (const chunk of stream) {
    currentExpr = chunk.expression;

    // ... 更新消息内容 ...

    if (debounceTimer !== null) continue;

    // 现在可以正确比较了
    if (currentExpr !== lastExpr) {
      // ... 表情切换代码 ...
      lastExpr = currentExpr;
    }
  }
}
```

---

## Bug 3 (P1) — AI 模式下传给 API 的上下文包含重复的用户消息

**文件**: `src/store/chatStore.ts`

**位置**: 第 40 行和第 73 行

**问题描述**:
第 40 行通过 `get()` 获取的 `messages` 是 `addMessage('user', content)` 执行前的旧值。第 47 行已将用户消息加入 store，但第 73 行又手动追加一条用户消息。传给 AI 的上下文会包含两条相同的用户消息。

```typescript
// 第 40 行: 获取旧值（此时用户消息尚未添加）
const { addMessage, messages } = get();

// 第 47 行: 将用户消息加入 store
addMessage('user', content);

// 第 72-73 行: 又追加了一遍用户消息
const allMsgs = [...messages, { id: uid(), role: 'user' as const, content, timestamp: Date.now() }];
```

**修复方案**:

```typescript
// 修复后 — 从 get() 重新获取最新的 messages
addMessage('user', content);

// 重新获取最新状态
const { messages: updatedMessages } = get();
const allMsgs = [...updatedMessages];
const stream = streamChat(allMsgs, settings.config);
```

---

## Bug 4 (P2) — `onTypingChange` 未用 `useCallback` 包裹导致 effect 不必要重跑

**文件**: `src/components/chat/ChatInput.tsx`

**位置**: 第 24-30 行

**问题描述**:
`onTypingChange` 是 `ChatWindow.tsx` 中每次渲染都重新创建的函数（非 `useCallback` 包裹），导致 `ChatInput` 中的 `useEffect` 每次渲染都重新执行。

**修复方案**:

在 `ChatWindow.tsx` 中:

```typescript
// 修复前
const handleTypingChange = (typing: boolean) => {
  setTypingAnimating(typing);
};

// 修复后
const handleTypingChange = useCallback((typing: boolean) => {
  setTypingAnimating(typing);
}, []);
```

---

## Bug 5 (P3) — 未使用的 `React` 导入

**文件**: `src/components/chat/ChatWindow.tsx`

**位置**: 第 1 行

**问题描述**:
`verbatimModuleSyntax` 开启时，`React` 导入未使用（React 19 不再需要显式导入 React 用于 JSX）。

**修复方案**:

```typescript
// 修复前
import React, { useEffect, useRef, useState } from 'react';

// 修复后
import { useEffect, useRef, useState } from 'react';
```

---

## 修复优先级总结

| 优先级 | Bug | 文件 | 说明 |
|--------|-----|------|------|
| P0 | Bug 1 | `chatStore.ts` | 不可变更新 → 解决消息不显示 |
| P0 | Bug 2 | `chatStore.ts` | 表情切换逻辑修复 |
| P1 | Bug 3 | `chatStore.ts` | 去除重复用户消息 |
| P2 | Bug 4 | `ChatInput.tsx` / `ChatWindow.tsx` | useCallback 优化 |
| P3 | Bug 5 | `ChatWindow.tsx` | 清理未使用导入 |

---

## 额外建议

在 `chatStore.ts` 的 `catch` 块中添加错误日志:

```typescript
} catch (err) {
  console.error('sendMessage 错误:', err);
  // ... 现有错误处理 ...
}
```

这有助于发现隐藏的运行时错误。
