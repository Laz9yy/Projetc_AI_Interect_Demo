// @ts-nocheck
import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import type { ExpressionType } from '../types';

// Cubism Core CDN 路径
const CUBISM_CORE_URL =
  'https://cdn.jsdelivr.net/npm/@cubism/sdk-web-framework@5.0.0/dist/index.js';

interface UseLive2DProps {
  modelUrl: string;
  expression: ExpressionType;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useLive2D({ modelUrl, expression, canvasRef }: UseLive2DProps) {
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const initializedRef = useRef(false);

  // 初始化 PIXI 应用
  const initPixi = useCallback(async () => {
    if (!canvasRef.current || initializedRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement!;

    const app = new PIXI.Application({
      view: canvas,
      width: parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: 0x0a0a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    appRef.current = app;
    initializedRef.current = true;

    // 加载 Cubism Core
    try {
      await import(/* @vite-ignore */ CUBISM_CORE_URL);
    } catch {
      console.warn('Cubism SDK CDN load failed, using bundled version');
    }

    // 加载模型
    try {
      const model = await Live2DModel.from(modelUrl, {
        autoInteract: false,
        motionPreloadStrategy: 'ALL',
      });

      // 适配画布大小
      const scale = Math.min(
        (parent.clientWidth * 0.7) / model.width,
        (parent.clientHeight * 0.85) / model.height,
      );
      model.scale.set(scale);
      model.x = parent.clientWidth / 2;
      model.y = parent.clientHeight * 0.45;
      model.anchor.set(0.5, 0.5);

      app.stage.addChild(model as any);
      modelRef.current = model;

      // 播放待机动画
      model.motion('idle', 0);
    } catch (err) {
      console.error('Live2D 模型加载失败:', err);
    }
  }, [modelUrl, canvasRef]);

  // 初始化
  useEffect(() => {
    const timer = setTimeout(() => {
      initPixi();
    }, 500);

    return () => clearTimeout(timer);
  }, [initPixi]);

  // 表情切换
  useEffect(() => {
    if (!modelRef.current) return;

    const model = modelRef.current;
    const exprDefs = model.internalModel.coreModel?.getExpressionIds?.();

    if (exprDefs && exprDefs.length > 0) {
      const exprMap: Record<string, string> = {
        happy: 'f01',
        sad: 'f02',
        surprised: 'f03',
        shy: 'f04',
        angry: 'f05',
        relaxed: 'f06',
        thinking: 'f07',
        neutral: 'f00',
      };

      const exprId = exprMap[expression] || 'f00';
      model.expression(exprId);
    }
  }, [expression]);

  // 清理
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []);

  return {
    isLoaded: modelRef.current !== null,
    playMotion: (motion: string) => modelRef.current?.motion(motion, 0),
  };
}
