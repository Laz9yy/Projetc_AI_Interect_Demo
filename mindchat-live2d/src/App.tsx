import React, { useEffect, useRef, useState } from 'react';
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
  const greetedRef = useRef(false);

  const character = characterPresets[selectedChar];
  const currentExprConfig = expressionList.find((e) => e.id === currentExpression);

  // 应用启动时显示角色问候语（延迟等 Live2D login 动画播放）
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;

    const timer = setTimeout(() => {
      useChatStore.getState().addMessage('assistant', character.greeting, 'shy');
    }, 800);

    return () => clearTimeout(timer);
  }, [character.greeting]);

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden"
      style={{ background: '#0A0A1A' }}>

      {/* ===== 右上角：AI 设置面板 ===== */}
      <SettingsPanel />

      {/* ===== 上层：场景 + Live2D 角色展示区 (75vh) ===== */}
      <div className="relative w-full overflow-hidden" style={{ height: '75vh' }}>
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

      {/* ===== 下层：通栏对话交互面板 (25vh) ===== */}
      <div className="glass-panel w-full z-30 flex flex-col" style={{ height: '25vh' }}>
        <ChatWindow />
      </div>
    </div>
  );
}

export default App;
