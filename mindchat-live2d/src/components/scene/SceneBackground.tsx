import React from 'react';

interface SceneBackgroundProps {
  src?: string;
}

const SceneBackground: React.FC<SceneBackgroundProps> = ({ src }) => {
  return (
    <div className="absolute inset-0 z-0 bg-[#0A0A1A]">
      {src && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(4px) saturate(0.7)',
          }}
        />
      )}
      {/* 暗色遮罩，增强文字可读性 */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
};

export default SceneBackground;
