import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../store/settingsStore';
import { usePersonalityStore } from '../../store/personalityStore';
import { useAffectionStore } from '../../store/affectionStore';
import { getPersonalityById } from '../../data/personalities';
import { aiProviders, getProvider } from '../../services/providers';
import PersonalityEditor from './PersonalityEditor';
import AffectionPanel from './AffectionPanel';

const SettingsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showPersonalityEditor, setShowPersonalityEditor] = useState(false);
  const [showAffectionPanel, setShowAffectionPanel] = useState(false);
  const { config, isConfigured, updateConfig, resetConfig } = useSettingsStore();
  const { activeId } = usePersonalityStore();
  const affection = useAffectionStore((s) => s.affection);

  const currentProvider = getProvider(config.provider);
  const activePersonality = getPersonalityById(activeId || 'default');

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg text-xs transition-all"
        style={{
          background: isConfigured
            ? 'rgba(0,212,255,0.15)'
            : 'rgba(255,107,157,0.15)',
          border: `1px solid ${isConfigured ? 'rgba(0,212,255,0.3)' : 'rgba(255,107,157,0.3)'}`,
          color: isConfigured ? '#00D4FF' : '#FF6B9D',
        }}
      >
        {isConfigured ? '⚡ AI 已连接' : '⚠ 未配置 AI'}
      </button>

      {/* 面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed top-14 right-4 z-50 w-80 p-5 rounded-xl backdrop-blur-xl"
            style={{
              background: 'rgba(10,10,26,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3 className="text-white/80 text-sm font-medium mb-4">AI 服务配置</h3>

            {/* 提供商选择 */}
            <label className="text-white/40 text-xs mb-1 block">提供商</label>
            <select
              value={config.provider}
              onChange={(e) => {
                const p = getProvider(e.target.value);
                if (p) {
                  updateConfig({
                    provider: p.id,
                    baseUrl: p.baseUrl,
                    model: p.defaultModel,
                  });
                }
              }}
              className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {aiProviders.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0A0A1A]">
                  {p.name}
                </option>
              ))}
            </select>

            {/* API Key */}
            <label className="text-white/40 text-xs mb-1 block">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />

            {/* 模型 */}
            <label className="text-white/40 text-xs mb-1 block">模型</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              placeholder={
                currentProvider?.defaultModel || 'gpt-4o-mini'
              }
              className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />

            {/* 自定义 Base URL */}
            {config.provider === 'custom' && (
              <>
                <label className="text-white/40 text-xs mb-1 block">
                  API 端点
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white/80 outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              </>
            )}

            {/* 人物性格修改入口 */}
            <div className="mb-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => {
                  setShowPersonalityEditor(!showPersonalityEditor);
                  if (showAffectionPanel) setShowAffectionPanel(false);
                }}
                className="w-full px-3 py-2.5 rounded-lg text-xs transition-all text-left flex items-center justify-between"
                style={{
                  background: showPersonalityEditor
                    ? 'rgba(124,92,252,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showPersonalityEditor ? 'rgba(124,92,252,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span className="flex items-center gap-2">
                  <span>🎭</span>
                  <span className="text-white/60">修改人物性格</span>
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: activePersonality?.color || '#7C5CFC' }} className="text-[10px]">
                    {activePersonality?.emoji} {activePersonality?.name}
                  </span>
                  <span className="text-white/20 text-[10px]">
                    {showPersonalityEditor ? '▲' : '▼'}
                  </span>
                </span>
              </button>

              <AnimatePresence>
                {showPersonalityEditor && (
                  <PersonalityEditor onClose={() => setShowPersonalityEditor(false)} />
                )}
              </AnimatePresence>
            </div>

            {/* 好感度查询入口 */}
            <div className="mb-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => {
                  setShowAffectionPanel(!showAffectionPanel);
                  if (showPersonalityEditor) setShowPersonalityEditor(false);
                }}
                className="w-full px-3 py-2.5 rounded-lg text-xs transition-all text-left flex items-center justify-between"
                style={{
                  background: showAffectionPanel
                    ? 'rgba(255,107,157,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showAffectionPanel ? 'rgba(255,107,157,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span className="flex items-center gap-2">
                  <span>❤</span>
                  <span className="text-white/60">好感度查询</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-white/30 text-[10px]">
                    好感度 {Math.round(affection)}
                  </span>
                  <span className="text-white/20 text-[10px]">
                    {showAffectionPanel ? '▲' : '▼'}
                  </span>
                </span>
              </button>

              <AnimatePresence>
                {showAffectionPanel && (
                  <AffectionPanel onClose={() => setShowAffectionPanel(false)} />
                )}
              </AnimatePresence>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 mt-4"> 
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm text-white/40 transition-colors hover:text-white/60"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                关闭
              </button>
              <button
                onClick={resetConfig}
                className="flex-1 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255,71,87,0.15)',
                  color: '#FF6B9D',
                }}
              >
                重置
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SettingsPanel;
