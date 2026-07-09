import React, { useRef, useState, useCallback } from 'react';
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

  return (
    <div ref={containerRef} className={`absolute inset-0 z-10 ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
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
