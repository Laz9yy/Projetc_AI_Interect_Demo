import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import type { Live2DModel } from 'pixi-live2d-display';
import type { ExpressionType } from '../../types';

// pixi-live2d-display 要求 PIXI 暴露到 window
(window as any).PIXI = PIXI;

interface Live2DViewerProps {
  modelUrl: string;
  expression: ExpressionType;
  className?: string;
}

const Live2DViewer: React.FC<Live2DViewerProps> = ({ modelUrl, expression, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const initializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [touchPulse, setTouchPulse] = useState(false); // P2-1: 触摸视觉反馈

  // 修复4: modelUrl 变化时重置状态，清除旧错误与初始化标志
  React.useEffect(() => {
    setError(null);
    setIsLoading(true);
    initializedRef.current = false;
  }, [modelUrl]);

  const init = useCallback(async () => {
    if (!canvasRef.current || !containerRef.current || initializedRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // 修复2.1: 使用 getBoundingClientRect 获取精确渲染尺寸
    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    if (w === 0 || h === 0) {
      // 修复2.1: rAF 延迟重试，更精确的布局时机
      requestAnimationFrame(() => setTimeout(init, 100));
      return;
    }

    // 修复2.2: 物理像素分辨率与 CSS 自适应分离
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    canvas.width = w * pixelRatio;
    canvas.height = h * pixelRatio;

    try {
      console.log('[Live2D C2] 初始化 PIXI', { w, h, pixelRatio });

      // 修复1: 使用 backgroundAlpha 官方 API 设置透明背景
      const app = new PIXI.Application({
        view: canvas,
        width: w,
        height: h,
        backgroundAlpha: 0,
        resolution: pixelRatio,
        autoDensity: true,
        antialias: true,
      });

      appRef.current = app;
      initializedRef.current = true;

      // ===== 运行时诊断 + CDN 自动降级 =====
      const win = window as any;

      if (typeof win.Live2D === 'undefined') {
        console.warn('[Live2D C2] 本地运行时未就绪，尝试 CDN 动态降级...');

        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('CDN 请求被拦截或网络不可达'));
            document.head.appendChild(script);
          });

          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 300));
            if (typeof win.Live2D !== 'undefined') break;
          }
        } catch (cdnErr) {
          console.error('[Live2D C2] CDN 备用降级也失败了:', cdnErr);
        }
      }

      if (typeof win.Live2D === 'undefined') {
        throw new Error(
          'Live2D 运行时未加载。\n' +
          '1. 检查 public/live2d.min.js 是否存在\n' +
          '2. 是否被浏览器插件拦截 CDN\n' +
          '3. 尝试 Ctrl+Shift+R 强制刷新缓存'
        );
      }

      console.log('[Live2D C2] 运行时就绪 ✅');

      const { Live2DModel } = await import('pixi-live2d-display/cubism2');
      Live2DModel.registerTicker(PIXI.Ticker);

      console.log('[Live2D C2] 加载模型:', modelUrl);
      const model = await Live2DModel.from(modelUrl, { autoInteract: false });

      // 修复3: 模型空值保护
      if (!model) {
        throw new Error(
          '模型对象创建失败：Live2DModel.from 返回了空值。\n' +
          '可能原因：模型文件损坏、CDN 跨域、或 JSON 解析异常'
        );
      }

      modelRef.current = model;

      // Galgame 大立绘：人物占上层 60% 高度，居中定位底部
      const modelW = (model as any)?.width || 1024;
      const modelH = (model as any)?.height || 1024;
      const targetH = h * 0.6;
      const scale = Math.min(targetH / modelH, (w * 0.5) / modelW) * 1.15;
      model.scale.set(scale);
      model.x = w / 2;
      model.y = h * 0.65;
      model.anchor.set(0.5, 0.5);

      app.stage.addChild(model as any);

      // ===== PIXI ticker 全局错误防御 =====
      // Cubism 运行时在异步动画帧中可能抛出无法被同步 try/catch 捕获的错误
      const tickerErrorHandler = (e: ErrorEvent) => {
        if (e.message?.includes('is not a function') || e.message?.includes('v[')) {
          e.preventDefault();
          e.stopPropagation();
          console.debug('[Live2D] Cubism ticker 内部错误已压制');
        }
      };
      window.addEventListener('error', tickerErrorHandler);
      // 模型销毁时移除监听
      const origDestroy = (model as any).destroy;
      (model as any).destroy = (...args: any[]) => {
        window.removeEventListener('error', tickerErrorHandler);
        return origDestroy?.apply(model, args);
      };
      // ===== 防御结束 =====

      setIsLoading(false);
      console.log('[Live2D C2] 加载成功 · 立绘尺寸', {
        scale: scale.toFixed(2),
        x: model.x,
        y: model.y,
        containerW: w,
        containerH: h,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Live2D C2] 失败:', msg, err);
      setError(msg);
      setIsLoading(false);
    }
  }, [modelUrl]);

  React.useEffect(() => {
    const timer = setTimeout(init, 300);
    return () => clearTimeout(timer);
  }, [init]);

  React.useEffect(() => {
    return () => {
      if (modelRef.current) { try { modelRef.current.destroy(); } catch {} }
      if (appRef.current) { try { appRef.current.destroy(true, { children: true }); } catch {} }
      initializedRef.current = false;
    };
  }, []);

  // ===== 情绪→表情+动作驱动层（不改渲染核心）=====
  const lastExprRef = useRef<ExpressionType>('neutral');
  const lastMotionTimeRef = useRef(0);
  const lastMotionKeyRef = useRef('');

  // 情绪→面部表情ID映射
  const EXPRESSION_IDS: Record<ExpressionType, string> = {
    neutral: 'f00', happy: 'f01', sad: 'f02', surprised: 'f03',
    shy: 'f04', angry: 'f05', relaxed: 'f06', thinking: 'f07',
  };

  // 情绪→动作映射（基于 model.json 中的 group + index）
  // P1-1: 改为数组支持随机动作变体，利用率 9/12 → 12/12
  const EMOTION_MOTIONS: Record<ExpressionType, Array<{ group: string; index: number }>> = {
    neutral:   [{ group: 'idle', index: 0 }],
    happy:     [{ group: '',     index: 2 }, { group: '', index: 3 }],   // touch_1 or touch_2
    sad:       [{ group: '',     index: 7 }],
    surprised: [{ group: '',     index: 1 }],
    shy:       [{ group: '',     index: 4 }, { group: '', index: 5 }],   // touch_3 or touch_4
    angry:     [{ group: '',     index: 6 }],
    thinking:  [{ group: '',     index: 8 }],
    relaxed:   [{ group: '',     index: 9 }, { group: '', index: 10 }],  // wedding or wedding_touch
  };

  // 优化4: 安全的表情切换 — 主 API + Cubism2 参数回退
  const applyExpression = useCallback((model: Live2DModel, exprId: string) => {
    // 路径A: pixi-live2d-display 标准 expression() API
    try {
      if (typeof (model as any).expression === 'function') {
        (model as any).expression(exprId);
        console.debug(`[Live2D] 表情切换: ${exprId} (standard API)`);
        return;
      }
    } catch {
      console.debug(`[Live2D] expression() 标准 API 失败，尝试 Cubism2 回退...`);
    }

    // 路径B: Cubism2 内部参数直设回退
    try {
      const internal = (model as any).internalModel;
      const core = internal?.coreModel;
      if (core && typeof core.setParameterValueById === 'function') {
        // 表情参数映射: Cubism2 SDK 标准 PARAM_ID
        const EXPR_PARAMS: Record<string, Array<{ id: string; value: number }>> = {
          'f00': [], // neutral — 复位所有到默认值
          'f01': [{ id: 'PARAM_EXPRESSION_JOY', value: 1 }],
          'f02': [{ id: 'PARAM_EXPRESSION_SADNESS', value: 1 }],
          'f03': [{ id: 'PARAM_EXPRESSION_SURPRISE', value: 1 }],
          'f04': [{ id: 'PARAM_EXPRESSION_SHY', value: 1 }],
          'f05': [{ id: 'PARAM_EXPRESSION_ANGER', value: 1 }],
          'f06': [{ id: 'PARAM_EXPRESSION_RELAXED', value: 1 }],
          'f07': [{ id: 'PARAM_EXPRESSION_THINKING', value: 1 }],
        };
        const params = EXPR_PARAMS[exprId] || [];
        if (params.length === 0 && exprId === 'f00') {
          // neutral: 复位所有表情参数
          const allExprParams = ['PARAM_EXPRESSION_JOY','PARAM_EXPRESSION_SADNESS','PARAM_EXPRESSION_SURPRISE','PARAM_EXPRESSION_SHY','PARAM_EXPRESSION_ANGER','PARAM_EXPRESSION_RELAXED','PARAM_EXPRESSION_THINKING'];
          allExprParams.forEach((p) => {
            try { core.setParameterValueById(p, 0); } catch {}
          });
        } else {
          params.forEach(({ id, value }) => {
            try { core.setParameterValueById(id, value); } catch {}
          });
        }
        console.debug(`[Live2D] 表情切换: ${exprId} (Cubism2 参数回退)`);
        return;
      }
    } catch (e) {
      console.warn(`[Live2D] Cubism2 参数回退也失败了:`, e);
    }

    console.debug(`[Live2D] 表情切换: ${exprId} 不可用（模型不支持表情 API）`);
  }, []);
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

  // ===== P2-2: 动作优先级系统 (必须在 emotion useEffect 之前定义) =====
  // 优先级: 1=login 2=触摸 3=情绪 4=idle (数字越小越高)
  const motionPriorityRef = useRef(0);
  const priorityTimerRef = useRef<number | null>(null);

  const resetPriorityAfterDelay = useCallback((delayMs = 500) => {
    if (priorityTimerRef.current) clearTimeout(priorityTimerRef.current);
    priorityTimerRef.current = window.setTimeout(() => {
      motionPriorityRef.current = 0;
      priorityTimerRef.current = null;
    }, delayMs);
  }, []);

  const tryPlayMotion = useCallback((
    model: Live2DModel,
    group: string,
    index: number,
    priority: number,
    durationMs = 500
  ): boolean => {
    if (motionPriorityRef.current > 0 && priority >= motionPriorityRef.current) {
      console.debug(`[Live2D] 动作拒绝(优先级): 当前P${motionPriorityRef.current} ≥ 请求P${priority}`);
      return false;
    }
    motionPriorityRef.current = priority;
    model.motion(group, index);
    resetPriorityAfterDelay(durationMs);
    return true;
  }, [resetPriorityAfterDelay]);

  // 监听 expression prop 变化，驱动模型面部表情 + 身体动作
  useEffect(() => {
    if (isLoading || error) return;

    // 初始化：expression='neutral' + lastExprRef='neutral' 时也播放一次 idle
    const isInitial = lastExprRef.current === 'neutral' && expression === 'neutral' && lastMotionKeyRef.current === '';

    // 同一表情不重复触发（初始化时除外）
    if (!isInitial && expression === lastExprRef.current) return;
    lastExprRef.current = expression;

    callModelSafely((model) => {
      // 1. 切换面部表情（优化4: 双路径回退保护）
      const exprId = EXPRESSION_IDS[expression] || 'f00';
      applyExpression(model, exprId);

      // 2. 播放身体动作（带间隔保护 + P1-1 随机变体）
      const motionPool = EMOTION_MOTIONS[expression];
      if (!motionPool || motionPool.length === 0) return;
      const motion = motionPool[Math.floor(Math.random() * motionPool.length)];

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
        // P2-2: 情绪动作优先级 3
        if (tryPlayMotion(model, motion.group, motion.index, 3, 2000)) {
          console.log(
            `[Live2D] 动作播放: group="${motion.group}" index=${motion.index} ` +
            `(情绪=${expression}, 距上次=${elapsedSinceLastMotion}ms)`
          );
        }
      } else {
        console.log(
          `[Live2D] 动作跳过: group="${motion.group}" index=${motion.index} ` +
          `(情绪=${expression}, sameMotion=${sameMotion}, 距上次=${elapsedSinceLastMotion}ms)`
        );
      }
    });
  }, [expression, isLoading, error, callModelSafely, tryPlayMotion]);

  // 应用启动时播放 login 登场动画 (P2-2: 优先级1 最高)
  useEffect(() => {
    if (isLoading || error) return;
    const timer = setTimeout(() => {
      callModelSafely((model) => {
        tryPlayMotion(model, '', 0, 1, 4000);
        lastMotionTimeRef.current = Date.now();
        lastMotionKeyRef.current = ':0';
        console.log('[Live2D] 登录动画播放: login.mtn (group="" index=0)');
      }, 'login');
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, error, callModelSafely, tryPlayMotion]);

  // ===== P0-2: 点击/触摸交互系统 =====
  const lastTouchTimeRef = useRef(0);
  const TOUCH_COOLDOWN = 2000;

  // 触摸动作池: 基于 model.json hit_areas (head/body/hand) 三区映射
  const handleCanvasClick = useCallback((e: PointerEvent) => {
    const now = Date.now();
    if (now - lastTouchTimeRef.current < TOUCH_COOLDOWN) return;
    if (isLoading || error) return;

    callModelSafely((model) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !canvasRef.current) return;
      const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
      const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

      // hitTest 尝试 / 坐标粗判回退
      let hitArea = 'body';
      try {
        if (typeof (model as any).hitTest === 'function') {
          const hit = (model as any).hitTest(x, y);
          if (hit) hitArea = hit;
        }
      } catch {
        const modelCenterY = rect.height * 0.4;
        if (y < modelCenterY * 0.7) hitArea = 'head';
        else if (y > modelCenterY * 1.3) hitArea = 'hand';
      }

      // 部位 → 动作池
      let pool: number[];
      switch (hitArea) {
        case 'head': pool = [2, 3]; break;   // touch_1, touch_2
        case 'hand': pool = [5, 6]; break;   // touch_4, touch_5
        default:     pool = [4];     break;   // touch_3 (body)
      }
      const idx = pool[Math.floor(Math.random() * pool.length)];

      if (tryPlayMotion(model, '', idx, 2, 1500)) {
        lastTouchTimeRef.current = now;
        // P2-1: 视觉反馈脉冲
        setTouchPulse(true);
        setTimeout(() => setTouchPulse(false), 400);
        console.log(`[Live2D] 触摸交互: hit=${hitArea}, motion=${idx}`);
      }
    }, 'touch');
  }, [isLoading, error, callModelSafely, tryPlayMotion]);

  // 绑定/解绑 canvas 触摸事件 (pointerdown 兼容桌面+移动端)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading || error) return;
    canvas.addEventListener('pointerdown', handleCanvasClick);
    canvas.style.cursor = 'pointer';
    return () => canvas.removeEventListener('pointerdown', handleCanvasClick);
  }, [isLoading, error, handleCanvasClick]);

  // ===== P0-1: idle 动作循环播放 =====
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading || error) return;
    if (expression !== 'neutral') {
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      return;
    }
    const playIdle = () => {
      callModelSafely((model) => {
        tryPlayMotion(model, 'idle', 0, 4, 3000);
      }, 'idle-loop');
      idleTimerRef.current = window.setTimeout(playIdle, 2500); // 提前500ms重播无缝衔接
    };
    playIdle();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [expression, isLoading, error, callModelSafely, tryPlayMotion]);

  // ===== P1-2: 空闲超时自发小动作 =====
  const autoMotionTimerRef = useRef<number | null>(null);
  const IDLE_AUTO_MOTIONS = [
    { group: '', index: 7 },  // wait_1
    { group: '', index: 8 },  // wait_2
  ];
  const AUTO_MOTION_INTERVAL = 20000; // 20秒

  const scheduleAutoMotion = useCallback(() => {
    if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current);
    autoMotionTimerRef.current = window.setTimeout(() => {
      callModelSafely((model) => {
        const m = IDLE_AUTO_MOTIONS[Math.floor(Math.random() * IDLE_AUTO_MOTIONS.length)];
        tryPlayMotion(model, m.group, m.index, 3, 1500);
        console.log(`[Live2D] 自发动作: group="${m.group}" index=${m.index}`);
      }, 'auto-motion');
      scheduleAutoMotion();
    }, AUTO_MOTION_INTERVAL);
  }, [callModelSafely, tryPlayMotion]);

  useEffect(() => {
    if (isLoading || error) return;
    if (expression === 'neutral') scheduleAutoMotion();
    else { if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current); }
    return () => { if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current); };
  }, [expression, isLoading, error, scheduleAutoMotion]);

  return (
    <div ref={containerRef} className={`absolute inset-0 z-10 ${className}`}>
      <canvas ref={canvasRef} className={`block w-full h-full ${touchPulse ? 'animate-pulse' : ''}`} />
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A1A]/60 z-20">
          <div className="flex gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#7C5CFC]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#FF6B9D]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#7C5CFC]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-white/40 text-sm">模型加载中...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A1A]/80 z-20 p-4">
          <span className="text-3xl mb-3">⚠</span>
          <p className="text-white/60 text-sm text-center mb-1">模型加载失败</p>
          <p className="text-white/25 text-xs text-center max-w-[260px] break-words">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Live2DViewer;
