import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GameEngine } from '@/game/engine';
import type { Mech } from '@/game/types';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const { setScreen, setWinner } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    engine.start((winner: Mech | null) => {
      setWinner(winner);
      setScreen('result');
    });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [setScreen, setWinner]);

  return (
    <div className="relative w-screen h-screen flex items-center justify-center bg-[#0a0a1a]">
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="border-4 border-[#4a4a6a] shadow-2xl"
        style={{
          imageRendering: 'pixelated',
          maxWidth: '100vw',
          maxHeight: '100vh',
        }}
      />
      <div className="crt-overlay" />
    </div>
  );
}
