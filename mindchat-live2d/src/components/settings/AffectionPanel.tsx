import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAffectionStore, getAffectionConfig } from '../../store/affectionStore';
import { clearChatHistory } from '../../services/chatHistory';
import { useChatStore } from '../../store/chatStore';

interface Props {
  onClose: () => void;
}

const AffectionPanel: React.FC<Props> = ({ onClose }) => {
  const {
    affection,
    isUnlocked,
    errorCount,
    cooldownUntil,
    attemptUnlock,
    lock,
    resetErrorCount,
    setAffection,
  } = useAffectionStore();

  const { clearMessages } = useChatStore();

  const [password, setPassword] = useState('');
  const [shake, setShake] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = getAffectionConfig(affection);

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

  // 面板关闭时自动锁定
  useEffect(() => {
    return () => {
      lock();
    };
  }, [lock]);

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

  const handleDeleteConfirm = () => {
    clearChatHistory();
    clearMessages();
    setShowDeleteConfirm(false);
  };

  // 好感度进度条百分比
  const percentage = Math.round(affection);
  // 渐变色
  const barColor =
    affection >= 100 ? '#FF3860' :
    affection >= 80  ? '#FF6B9D' :
    affection >= 70  ? '#5B8DEF' :
    affection >= 30  ? '#4ECDC4' :
    '#7C8B9C';

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
          ❤ 好感度查询
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
              查询好感度需要输入管理员密码进行验证。
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
                placeholder="请输入管理员密码"
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

        {/* 好感度展示 */}
        {isUnlocked && (
          <motion.div
            key="affection-display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* 等级标签 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/35 text-xs">当前等级：</span>
              <span className="text-xs font-medium" style={{ color: config.color }}>
                {config.emoji} {config.labelCn}（{config.label}）
              </span>
            </div>

            {/* 进度条 */}
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span className="text-white/50 text-xs">好感度</span>
                <span className="text-xs font-bold" style={{ color: barColor }}>
                  {percentage}/100
                </span>
              </div>
              <div
                className="w-full h-3 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    background: `linear-gradient(90deg, #4ECDC4, #5B8DEF, ${barColor})`,
                    boxShadow: `0 0 8px ${barColor}40`,
                  }}
                />
              </div>
            </div>

            {/* 称呼 */}
            <div
              className="flex items-center justify-center gap-2 mt-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="text-white/35 text-xs">当前称呼：</span>
              <span className="text-sm font-medium" style={{ color: config.color }}>
                {config.title}
              </span>
            </div>

            {/* 管理员好感度修改 */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-xs">🔧 管理员修改好感度</span>
              </div>

              {/* 滑块 */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-white/30 text-[10px]">0</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={affection}
                  onChange={(e) => setAffection(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(90deg, #7C8B9C, #4ECDC4, #5B8DEF, #FF6B9D, #FF3860)`,
                    accentColor: barColor,
                  }}
                />
                <span className="text-white/30 text-[10px]">100</span>
              </div>

              {/* 数值微调 */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={() => setAffection(Math.max(0, affection - 5))}
                  className="w-8 h-7 rounded-lg text-xs text-white/50 transition-colors hover:text-white/80"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  −5
                </button>
                <button
                  onClick={() => setAffection(Math.max(0, affection - 0.5))}
                  className="w-8 h-7 rounded-lg text-xs text-white/50 transition-colors hover:text-white/80"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  −
                </button>
                <span
                  className="text-sm font-bold px-3 py-1 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: barColor,
                    minWidth: '52px',
                    textAlign: 'center',
                  }}
                >
                  {affection % 1 === 0 ? affection : affection.toFixed(1)}
                </span>
                <button
                  onClick={() => setAffection(Math.min(100, affection + 0.5))}
                  className="w-8 h-7 rounded-lg text-xs text-white/50 transition-colors hover:text-white/80"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  +
                </button>
                <button
                  onClick={() => setAffection(Math.min(100, affection + 5))}
                  className="w-8 h-7 rounded-lg text-xs text-white/50 transition-colors hover:text-white/80"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  +5
                </button>
              </div>

              {/* 快捷预设 */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { label: '陌生', val: 10, emoji: '🤝', color: '#7C8B9C' },
                  { label: '熟悉', val: 30, emoji: '😊', color: '#4ECDC4' },
                  { label: '亲近', val: 70, emoji: '💙', color: '#5B8DEF' },
                  { label: '暧昧', val: 85, emoji: '💗', color: '#FF6B9D' },
                  { label: '挚爱', val: 100, emoji: '💞', color: '#FF3860' },
                ] as const).map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => setAffection(preset.val)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] transition-all"
                    style={{
                      background: affection === preset.val
                        ? `${preset.color}20`
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${affection === preset.val ? preset.color + '40' : 'rgba(255,255,255,0.06)'}`,
                      color: affection === preset.val ? preset.color : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {preset.emoji} {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 分隔线 */}
            <div className="my-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* 删除聊天记录按钮 */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 rounded-lg text-xs transition-all"
              style={{
                background: 'rgba(255,71,87,0.08)',
                border: '1px solid rgba(255,71,87,0.2)',
                color: '#FF6B9D',
              }}
            >
              🗑 删除聊天记录
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="p-6 rounded-xl max-w-xs mx-4 text-center"
              style={{
                background: 'rgba(20,20,45,0.98)',
                border: '1px solid rgba(255,71,87,0.25)',
              }}
            >
              <div className="text-3xl mb-3">💔</div>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                你想好要删掉和她的回忆么？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-xs text-white/40 transition-colors hover:text-white/60"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2 rounded-lg text-xs transition-all"
                  style={{
                    background: 'rgba(255,71,87,0.2)',
                    color: '#FF4757',
                  }}
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AffectionPanel;
