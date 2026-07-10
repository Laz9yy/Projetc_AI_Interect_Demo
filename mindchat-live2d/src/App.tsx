import React, { useCallback, useEffect, useRef, useState } from 'react';
import Live2DViewer from './components/Live2D/Live2DViewer';
import ChatWindow from './components/chat/ChatWindow';
import SceneBackground from './components/scene/SceneBackground';
import CharacterOverlay from './components/scene/CharacterOverlay';
import ProjectCredit from './components/scene/ProjectCredit';
import SettingsPanel from './components/settings/SettingsPanel';
import { useChatStore } from './store/chatStore';
import { characterPresets } from './data/characters';
import { expressionList } from './data/expressions';

function App() {
  const { currentExpression } = useChatStore();
  const [selectedChar] = useState(0);
  const [chatRatio, setChatRatio] = useState(0.25);
  const isDragging = useRef(false);

  const character = characterPresets[selectedChar];
  const currentExprConfig = expressionList.find((e) => e.id === currentExpression);

  // 每次页面刷新先清空历史消息再发送问候语
  useEffect(() => {
    useChatStore.getState().clearMessages();

    const timer = setTimeout(() => {
      useChatStore.getState().addMessage('assistant', character.greeting, 'shy');
    }, 800);

    return () => clearTimeout(timer);
  }, [character.greeting]);

  // 拖拽分栏 —— 鼠标按下把手开始跟踪
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // 全局鼠标/触摸移动 + 释放
  useEffect(() => {
    let rafId: number | null = null;

    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      if (rafId !== null) return;
      const clientY = e.clientY;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newRatio = 1 - clientY / window.innerHeight;
        setChatRatio(Math.max(0.15, Math.min(0.60, newRatio)));
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      if (rafId !== null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const clientY = touch.clientY;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newRatio = 1 - clientY / window.innerHeight;
        setChatRatio(Math.max(0.15, Math.min(0.60, newRatio)));
      });
    };

    const handleDragEnd = () => {
      isDragging.current = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, []);

  const live2dHeight = `${(1 - chatRatio) * 100}vh`;
  const chatHeight = `${chatRatio * 100}vh`;

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden"
      style={{ background: '#0A0A1A' }}>

      {/* ===== 右上角：AI 设置面板 ===== */}
      <SettingsPanel />

      {/* ===== 上层：场景 + Live2D 角色展示区 (75vh) ===== */}
      <div className="relative w-full overflow-hidden" style={{ height: live2dHeight }}>
        {/* 场景背景 */}
        <SceneBackground />

        {/* Live2D 全身大立绘 */}
        <Live2DViewer
          key={character.modelUrl}
          modelUrl={character.modelUrl}
          expression={currentExpression}
        />

        {/* 左上角：角色状态文字 */}
        <CharacterOverlay
          name={character.name}
          status={currentExprConfig?.labelCn || '平静'}
        />

        {/* 左上角：项目标题（极小） */}
        <ProjectCredit />
      </div>

      {/* ===== 拖拽把手：向上拉动扩大聊天区 ===== */}
      <div
        className="chat-resize-handle"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      />

      {/* ===== 下层：通栏对话交互面板 ===== */}
      <div className="glass-panel w-full z-30 flex flex-col" style={{ height: chatHeight }}>
        <ChatWindow />
      </div>
    </div>
  );
}

export default App;
