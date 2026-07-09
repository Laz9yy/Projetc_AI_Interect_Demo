# 情绪-动作系统修复方案

> 问题：人物模型只有开场动作（login）及休闲动作（idle），其他情绪动作（happy/sad/surprised/shy/angry/thinking/relaxed）均未按文档规定播放。

---

## 根因总结

| 编号 | 根因 | 影响 |
|------|------|------|
| RC1 | 1500ms 全局动作间隔 + thinking 动作先触发 → 后续情绪动作被 `tooSoon` 拦截 | **主因：所有情绪动作丢失** |
| RC2 | 登录动画 `model.motion('', 0)` 不更新 `lastMotionTimeRef` | 时间戳为 0，加剧 RC1 |
| RC3 | `chatStore.ts` 中 `lastExpr` 初始为 `'neutral'`，但 store 在第 53 行已设为 `'thinking'` | 首个 chunk 的 `thinking` 会重复 set，额外消耗一次状态更新 |
| RC4 | `model.motion()` 错误被静默吞掉，无日志 | 无法判断 motion 是否真的被调用/成功 |
| RC5 | 初始 `expression='neutral'` 时 `lastExprRef` 也是 `'neutral'`，idle 从未由代码触发 | 依赖模型文件自动循环，不可靠 |

---

## 修复 1（P0）：重写动作间隔保护逻辑

**文件**：`mindchat-live2d/src/components/Live2D/Live2DViewer.tsx`  
**行号**：228-243

### 当前代码

```ts
      const now = Date.now();
      const motionKey = motion.group + ':' + motion.index;
      const sameMotion = motionKey === lastMotionKeyRef.current;
      const tooSoon = now - lastMotionTimeRef.current < 1500;

      if (!sameMotion || now - lastMotionTimeRef.current >= 3000) {
        if (!tooSoon) {
          lastMotionKeyRef.current = motionKey;
          lastMotionTimeRef.current = now;
          try { model.motion(motion.group, motion.index); } catch { /* motion 不存在时跳过 */ }
        }
      }
```

### 问题

- `tooSoon` 检查是**全局**的：任何两次 motion 调用之间必须间隔 ≥1500ms
- 用户发送消息 → thinking 动作在 t=0ms 播放 → AI 在 ~1000ms 返回 happy → 1000 < 1500 → **被拦截**
- 之后 expression 保持 happy 不变 → 所有后续窗口全部被去重跳过 → **happy 动作永久丢失**

### 修复后代码

将上述 228-243 行替换为：

```ts
      const motionKey = motion.group + ':' + motion.index;
      const sameMotion = motionKey === lastMotionKeyRef.current;
      const now = Date.now();
      const elapsedSinceLastMotion = now - lastMotionTimeRef.current;

      // 策略：同一动作冷却 3 秒；不同动作冷却仅 300ms；首次调用不检查
      const shouldPlay =
        lastMotionKeyRef.current === ''
          ? true                                           // 首次调用，立即播放
          : sameMotion
            ? elapsedSinceLastMotion >= 3000               // 同一动作需要 3 秒冷却
            : elapsedSinceLastMotion >= 300;               // 不同动作仅需 300ms 间隔

      if (shouldPlay) {
        lastMotionKeyRef.current = motionKey;
        lastMotionTimeRef.current = now;
        try {
          model.motion(motion.group, motion.index);
          console.log(
            `[Live2D] 动作播放: group="${motion.group}" index=${motion.index} ` +
            `(情绪=${expression}, 距上次=${elapsedSinceLastMotion}ms)`
          );
        } catch (e) {
          console.warn(
            `[Live2D] 动作失败: group="${motion.group}" index=${motion.index}`, e
          );
        }
      } else {
        console.log(
          `[Live2D] 动作跳过: group="${motion.group}" index=${motion.index} ` +
          `(情绪=${expression}, sameMotion=${sameMotion}, 距上次=${elapsedSinceLastMotion}ms)`
        );
      }
```

### 改动说明

| 项目 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 不同动作间隔 | 1500ms 全局 | **300ms** |
| 相同动作冷却 | 无独立规则（仅在 !sameMotion \|\| ≥3000 时进入） | **3000ms** |
| 首次调用 | 受 1500ms 限制 | **直接播放**（`lastMotionKeyRef === ''`） |
| 日志 | 无 | **播放/跳过/失败均有日志** |

---

## 修复 2（P0）：登录动画同步更新时间戳

**文件**：`mindchat-live2d/src/components/Live2D/Live2DViewer.tsx`  
**行号**：248-256

### 当前代码

```ts
  useEffect(() => {
    if (isLoading || error) return;
    const timer = setTimeout(() => {
      callModelSafely((model) => {
        try { model.motion('', 0); } catch { /* login.mtn */ }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, error, callModelSafely]);
```

### 修复后代码

将上述 248-256 行替换为：

```ts
  useEffect(() => {
    if (isLoading || error) return;
    const timer = setTimeout(() => {
      callModelSafely((model) => {
        try {
          model.motion('', 0);
          // 同步更新动作时间戳，使后续情绪动作的间隔计算正确
          lastMotionTimeRef.current = Date.now();
          lastMotionKeyRef.current = ':0';
          console.log('[Live2D] 登录动画播放: login.mtn (group="" index=0)');
        } catch (e) {
          console.warn('[Live2D] 登录动画失败:', e);
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, error, callModelSafely]);
```

### 改动说明

- 登录动画后更新 `lastMotionTimeRef` 和 `lastMotionKeyRef`
- 增加日志记录

---

## 修复 3（P1）：`lastExpr` 初始值同步

**文件**：`mindchat-live2d/src/store/chatStore.ts`  
**行号**：71

### 当前代码

```ts
      let lastExpr = 'neutral';
```

### 修复后代码

```ts
      // 从 store 当前状态读取，与第 53 行的 set({ currentExpression: 'thinking' }) 保持一致
      let lastExpr: string = get().currentExpression;
```

### 改动说明

- 第 53 行已将 store 的 `currentExpression` 设为 `'thinking'`，`lastExpr` 应从 store 读取而非硬编码 `'neutral'`
- 避免 AI 流首个 chunk（也是 `'thinking'`）重复 set 一次

---

## 修复 4（P1）：`callModelSafely` 增加调试日志

**文件**：`mindchat-live2d/src/components/Live2D/Live2DViewer.tsx`  
**行号**：204-213

### 当前代码

```ts
  const callModelSafely = useCallback((fn: (model: Live2DModel) => void) => {
    const model = modelRef.current;
    if (!model) return;
    try {
      if ((model as any).destroyed) return;
      fn(model);
    } catch (e) {
      console.debug('[Live2D] 模型调用忽略:', e);
    }
  }, []);
```

### 修复后代码

```ts
  const callModelSafely = useCallback((fn: (model: Live2DModel) => void, tag?: string) => {
    const model = modelRef.current;
    if (!model) {
      console.debug(`[Live2D] callModelSafely 跳过(${tag || '?'}): modelRef 为 null`);
      return;
    }
    try {
      if ((model as any).destroyed) {
        console.debug(`[Live2D] callModelSafely 跳过(${tag || '?'}): model 已销毁`);
        return;
      }
      fn(model);
    } catch (e) {
      console.warn(`[Live2D] callModelSafely 异常(${tag || '?'}):`, e);
    }
  }, []);
```

### 改动说明

- 增加 `tag` 参数标识调用来源
- 将静默 `console.debug` 改为更详细的日志
- 区分 "modelRef 为空" 和 "model 已销毁" 两种情况

---

## 修复 5（P2）：初始 idle 动作显式播放

**文件**：`mindchat-live2d/src/components/Live2D/Live2DViewer.tsx`  
**行号**：215-221（在 expression 监听 effect 内）

### 当前代码

```ts
  useEffect(() => {
    if (isLoading || error) return;

    // 同一表情不重复触发
    if (expression === lastExprRef.current) return;
    lastExprRef.current = expression;
```

### 修复后代码

```ts
  useEffect(() => {
    if (isLoading || error) return;

    // 初始化：expression='neutral' + lastExprRef='neutral' 时也播放一次 idle
    const isInitial = lastExprRef.current === 'neutral' && expression === 'neutral' && lastMotionKeyRef.current === '';

    // 同一表情不重复触发（初始化时除外）
    if (!isInitial && expression === lastExprRef.current) return;
    lastExprRef.current = expression;
```

### 改动说明

- 增加 `isInitial` 判断：当 expression 和 lastExprRef 都是 `'neutral'` 且从未播放过任何动作时，允许进入后续的 motion 播放逻辑
- 这样 idle 动作会由我们的代码显式触发，不再依赖模型文件的自动循环

---

## 完整修改汇总

| 文件 | 修改行号 | 修改摘要 |
|------|----------|----------|
| `Live2DViewer.tsx` | 204-213 | `callModelSafely` 增加 tag 参数和详细日志 |
| `Live2DViewer.tsx` | 216-221 | 增加 `isInitial` 判断，允许初始 neutral 触发 idle |
| `Live2DViewer.tsx` | 228-243 | 重写动作保护：300ms 间隔 + 同步情绪冷却 + 日志 |
| `Live2DViewer.tsx` | 248-256 | 登录动画同步更新 lastMotionTimeRef/KeyRef + 日志 |
| `chatStore.ts` | 71 | `lastExpr` 从 `get().currentExpression` 读取 |

---

## 修改后的预期行为

```
时间线（用户发送消息后）：
t=0ms     → thinking 动作 (wait_2) 播放                 ✅
t=600ms   → AI 返回首个 chunk, expression=thinking     （去重跳过）
t=1000ms  → 防抖窗口打开, inferExpression 返回 happy
            → happy != thinking → 不同动作，300ms 检查通过
            → happy 动作 (touch_1) 播放                 ✅ [修复前被拦截]
t=2000ms  → 防抖窗口打开, expression 仍为 happy
            → sameMotion=true, 距上次 1000ms < 3000ms
            → 跳过                                      ✅
t=6000ms  → HOLD 超时 → neutral → idle 动作播放        ✅
```

---

## 验证方法

修改后，打开浏览器控制台，发送一条消息，应看到类似日志：

```
[Live2D] 动作播放: group="" index=8 (情绪=thinking, 距上次=0ms)
[Live2D] 动作播放: group="" index=2 (情绪=happy, 距上次=350ms)
[Live2D] 动作跳过: group="" index=2 (情绪=happy, sameMotion=true, 距上次=1200ms)
...
[Live2D] 动作播放: group="idle" index=0 (情绪=neutral, 距上次=6500ms)
```

如果看不到某条日志，说明对应 motion 文件可能缺失或 API 签名不匹配，需检查 `model.json` 中的 `motions` 配置。
