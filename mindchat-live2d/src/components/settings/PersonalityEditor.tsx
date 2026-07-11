import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePersonalityStore } from '../../store/personalityStore';
import { personalityPresets, getPersonalityById } from '../../data/personalities';

interface Props {
  onClose: () => void;
}

const PersonalityEditor: React.FC<Props> = ({ onClose }) => {
  const {
    isUnlocked,
    activeId,
    errorCount,
    cooldownUntil,
    attemptUnlock,
    setActive,
    resetToDefault,
    resetErrorCount,
  } = usePersonalityStore();

  const [password, setPassword] = useState('');
  const [shake, setShake] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 冷却倒计时
  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownRemaining(0);
        resetErrorCount();
        return;
      }
      setCooldownRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [cooldownUntil, resetErrorCount]);

  // 自动聚焦
  useEffect(() => {
    if (!isUnlocked && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isUnlocked, shake]);

  const handleUnlock = () => {
    if (cooldownRemaining > 0) return;
    const success = attemptUnlock(password);
    if (!success) {
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  };

  const currentPersonality = activeId ? getPersonalityById(activeId) : getPersonalityById('default');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-3 p-4 rounded-xl"
      style={{
        background: 'rgba(15,15,35,0.96)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white/70 text-xs font-medium">
          🎭 修改人物性格
        </h4>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          收起 ▲
        </button>
      </div>

      {/* 密码门 */}
      <AnimatePresence mode="wait">
        {!isUnlocked && (
          <motion.div
            key="password-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-white/35 text-xs mb-3 leading-relaxed">
              修改人物性格需要输入授权密码。请联系管理员获取密码。
            </p>

            <motion.div
              animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请输入权限密码"
                disabled={cooldownRemaining > 0}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: cooldownRemaining > 0
                    ? 'rgba(255,107,157,0.05)'
                    : 'rgba(255,255,255,0.05)',
                  border: shake
                    ? '1px solid rgba(255,71,87,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: cooldownRemaining > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                }}
              />
            </motion.div>

            {/* 错误提示 / 冷却 */}
            <div className="flex items-center justify-between mt-2">
              {cooldownRemaining > 0 ? (
                <span className="text-xs" style={{ color: '#FF6B9D' }}>
                  ⏳ 密码错误次数过多，请等待 {cooldownRemaining} 秒
                </span>
              ) : errorCount > 0 ? (
                <span className="text-xs" style={{ color: '#FF4757' }}>
                  ❌ 密码错误 ({errorCount}/3)
                </span>
              ) : (
                <span />
              )}
              <button
                onClick={handleUnlock}
                disabled={cooldownRemaining > 0 || password.length === 0}
                className="px-4 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: cooldownRemaining > 0 || password.length === 0
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(124,92,252,0.2)',
                  border: '1px solid rgba(124,92,252,0.3)',
                  color: cooldownRemaining > 0 || password.length === 0
                    ? 'rgba(255,255,255,0.2)'
                    : '#7C5CFC',
                  cursor: cooldownRemaining > 0 || password.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                验证
              </button>
            </div>
          </motion.div>
        )}

        {/* 性格选择网格 */}
        {isUnlocked && (
          <motion.div
            key="personality-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* 当前性格指示 */}
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="text-white/35">当前：</span>
              <span style={{ color: currentPersonality?.color || '#7C5CFC' }}>
                {currentPersonality?.emoji} {currentPersonality?.name}
              </span>
            </div>

            {/* 性格卡片网格 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {personalityPresets.map((preset) => {
                const isActive = (activeId || 'default') === preset.id;
                return (
                  <motion.button
                    key={preset.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (preset.id === 'default') {
                        resetToDefault();
                      } else {
                        setActive(preset.id);
                      }
                    }}
                    className="p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: isActive
                        ? `${preset.color}15`
                        : 'rgba(255,255,255,0.03)',
                      border: isActive
                        ? `1px solid ${preset.color}40`
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isActive
                        ? `0 0 12px ${preset.color}15`
                        : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{preset.emoji}</span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: isActive ? preset.color : 'rgba(255,255,255,0.7)' }}
                      >
                        {preset.name}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="active-dot"
                          className="ml-auto w-2 h-2 rounded-full"
                          style={{ background: preset.color }}
                        />
                      )}
                    </div>
                    <p className="text-white/30 text-[10px] leading-relaxed">
                      {preset.description}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            {/* 底部提示 */}
            <p className="text-white/20 text-[10px] text-center">
              切换性格后，下一次 AI 对话将自动生效
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PersonalityEditor;
