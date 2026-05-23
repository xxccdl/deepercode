import { useGameStore } from '@/store/gameStore';
import Menu from '@/pages/Menu';
import Game from '@/pages/Game';
import Result from '@/pages/Result';

export default function App() {
  const { screen } = useGameStore();

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0a0a1a]">
      {screen === 'menu' && <Menu />}
      {screen === 'game' && <Game />}
      {screen === 'result' && <Result />}
    </div>
  );
}
