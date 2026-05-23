import { useGameStore } from '@/store/gameStore';
import { audioManager } from '@/game/audio';
import { useState } from 'react';
import { Volume2, VolumeX, Gamepad2, HelpCircle, Swords } from 'lucide-react';

export default function Menu() {
  const { setScreen, soundEnabled, toggleSound } = useGameStore();
  const [showHelp, setShowHelp] = useState(false);

  const handleStart = () => {
    audioManager.init();
    audioManager.setEnabled(soundEnabled);
    setScreen('game');
  };

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a1a]">
        <StarField />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="float-anim text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Swords className="w-10 h-10 text-[#00d4ff]" />
            <Swords className="w-10 h-10 text-[#ff2a6d] scale-x-[-1]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#ffd700] tracking-wider" style={{ fontFamily: '"Press Start 2P", monospace', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
            机甲对战
          </h1>
          <p className="mt-4 text-sm text-[#888] blink-cursor" style={{ fontFamily: '"Press Start 2P", monospace' }}>
            PIXEL MECH BATTLE
          </p>
        </div>

        <div className="flex flex-col gap-4 w-64">
          <button
            onClick={handleStart}
            className="pixel-btn text-center flex items-center justify-center gap-2"
          >
            <Gamepad2 className="w-4 h-4" />
            开始对战
          </button>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="pixel-btn text-center flex items-center justify-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            操作说明
          </button>

          <button
            onClick={() => {
              toggleSound();
              audioManager.setEnabled(!soundEnabled);
            }}
            className="pixel-btn text-center flex items-center justify-center gap-2"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            音效 {soundEnabled ? '开' : '关'}
          </button>
        </div>

        {showHelp && (
          <div className="pixel-panel mt-4 max-w-md">
            <h3 className="text-[#ffd700] text-sm mb-4 text-center" style={{ fontFamily: '"Press Start 2P", monospace' }}>
              操作说明
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[#00d4ff] mb-2 font-bold">玩家1 - 蓝影</p>
                <div className="space-y-1 text-[#ccc]">
                  <p>A / D - 左右移动</p>
                  <p>W - 跳跃</p>
                  <p>J - 普通攻击</p>
                  <p>K - 防御</p>
                  <p>L - 技能 (需能量)</p>
                </div>
              </div>
              <div>
                <p className="text-[#ff2a6d] mb-2 font-bold">玩家2 - 赤焰</p>
                <div className="space-y-1 text-[#ccc]">
                  <p>← / → - 左右移动</p>
                  <p>↑ - 跳跃</p>
                  <p>1 - 普通攻击</p>
                  <p>2 - 防御</p>
                  <p>3 - 技能 (需能量)</p>
                </div>
              </div>
            </div>
            <p className="text-[#888] text-[10px] mt-4 text-center">
              将对方血量削减至零即可获胜！
            </p>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 text-[#444] text-[10px]" style={{ fontFamily: '"Press Start 2P", monospace' }}>
        v1.0 - 像素风机甲对战
      </div>
    </div>
  );
}

function StarField() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 0.5 + 0.2,
    delay: Math.random() * 3,
  }));

  return (
    <>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: 0.3 + Math.random() * 0.7,
            animation: `pulse ${2 + star.speed}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}
