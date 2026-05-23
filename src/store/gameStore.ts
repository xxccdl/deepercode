import { create } from 'zustand';
import type { Mech } from '@/game/types';

type GameScreen = 'menu' | 'game' | 'result';

interface GameStore {
  screen: GameScreen;
  winner: Mech | null;
  soundEnabled: boolean;
  setScreen: (screen: GameScreen) => void;
  setWinner: (winner: Mech | null) => void;
  toggleSound: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'menu',
  winner: null,
  soundEnabled: true,
  setScreen: (screen) => set({ screen }),
  setWinner: (winner) => set({ winner }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
