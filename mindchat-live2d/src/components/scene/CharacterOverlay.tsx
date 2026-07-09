import React from 'react';
import { motion } from 'framer-motion';

interface CharacterOverlayProps {
  name: string;
  status: string;
}

const CharacterOverlay: React.FC<CharacterOverlayProps> = ({ name, status }) => {
  return (
    <motion.div
      className="absolute top-4 left-6 z-20"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <h1 className="text-[18px] font-bold text-white text-stroke">
        {name}
      </h1>
      <p className="text-[14px] font-light text-white/55 flex items-center gap-1.5 mt-0.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.40)' }}
        />
        {status}
      </p>
    </motion.div>
  );
};

export default CharacterOverlay;
