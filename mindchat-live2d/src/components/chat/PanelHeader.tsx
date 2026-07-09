import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';

interface PanelHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ collapsed, onToggleCollapse }) => {
  const { clearMessages } = useChatStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleClear = () => {
    clearMessages();
    setMenuOpen(false);
  };

  return (
    <div
      className="flex items-center justify-between flex-shrink-0"
      style={{ height: 36, padding: '8px 20px' }}
    >
      {/* 左侧：头像 + 在线状态 */}
      <div className="flex items-center gap-2">
        {/* Haru 头像 */}
        <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-[#7C5CFC] to-[#FF6B9D] flex-shrink-0 flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">H</span>
          {/* 在线绿点 */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#4ADE80] border border-[#0A0A1A]" />
        </div>
        <span className="text-sm text-white/60 font-medium">Haru</span>
        <span className="text-xs text-white/25">· 在线</span>
      </div>

      {/* 右侧：折叠按钮 + 三点下拉菜单 */}
      <div className="flex items-center gap-1" ref={menuRef}>
        {/* 三点下拉菜单 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors text-sm leading-none"
        >
          ⋮
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-2 top-full mt-1 z-50 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]"
            >
              <button
                onClick={handleClear}
                className="w-full text-left px-4 py-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                清空对话
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 折叠按钮 */}
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors"
        >
          <motion.span
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="text-xs leading-none"
          >
            ▼
          </motion.span>
        </button>
      </div>
    </div>
  );
};

export default PanelHeader;
