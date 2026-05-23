import { useGameStore } from '@/store/gameStore';
import { audioManager } from '@/game/audio';
import { Trophy, RotateCcw, Home, Skull } from 'lucide-react';

export default function Result() {
  const { winner, setScreen, soundEnabled } = useGameStore();

  const handleRestart = () => {
    audioManager.setEnabled(soundEnabled);
    setScreen('game');
  };

  const isDraw = winner === null;
  const winnerName = winner?.name || '';
  const winnerTeam = winner?.team;

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a1a]">
      <div className="absolute inset-0">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: 0.2 + Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {isDraw ? (
          <>
            <Skull className="w-16 h-16 text-[#888]" />
            <h1
              className="text-3xl text-[#888]"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                textShadow: '0 0 15px rgba(136, 136, 136, 0.5)',
              }}
            >
              平局
            </h1>
          </>
        ) : (
          <>
            <Trophy
              className="w-16 h-16 glow-gold"
              style={{
                color: winnerTeam === 'blue' ? '#00d4ff' : '#ff2a6d',
              }}
            />
            <h1
              className="text-3xl"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                color: winnerTeam === 'blue' ? '#00d4ff' : '#ff2a6d',
                textShadow:
                  winnerTeam === 'blue'
                    ? '0 0 20px rgba(0, 212, 255, 0.6)'
                    : '0 0 20px rgba(255, 42, 109, 0.6)',
              }}
            >
              {winnerName} 获胜!
            </h1>
          </>
        )}

        <div className="pixel-panel mt-4">
          <p className="text-[#ccc] text-xs text-center" style={{ fontFamily: '"Press Start 2P", monospace' }}>
            {isDraw ? '双方势均力敌' : `${winnerName} 击败了对手！`}
          </p>
        </div>

        <div className="flex flex-col gap-4 w-64 mt-4">
          <button
            onClick={handleRestart}
            className="pixel-btn text-center flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            再来一局
          </button>

          <button
            onClick={() => setScreen('menu')}
            className="pixel-btn text-center flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            返回主菜单
          </button>
        </div>
      </div>

      <div className="crt-overlay" />
    </div>
  );
}
