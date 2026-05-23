# -*- coding: utf-8 -*-
"""
中国象棋 - 命令行交互界面

提供友好的命令行用户界面，支持：
- 人机对战
- 观看AI对弈
- 实时棋盘显示
- 走法输入验证
"""
import sys
import os
import time
from typing import Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.board import Board
from core.pieces import Move, Piece
from search.alphabeta import ChessAI
from learning.trainer import SelfPlayTrainer


class ChessCLI:
    """中国象棋命令行界面"""
    
    def __init__(self):
        self.board = Board()
        self.ai = ChessAI(max_depth=4)  # AI搜索深度为4层
        self.human_color = 'red'  # 人类默认执红（先手）
        self.game_over = False
        self.move_count = 0
    
    def clear_screen(self):
        """清屏"""
        os.system('cls' if sys.platform == 'win32' else 'clear')
    
    def print_banner(self):
        """打印欢迎横幅"""
        banner = """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🎮 中国象棋智能对弈系统 v1.0                           ║
║     🤖 基于Alpha-Beta搜索 + 自博弈学习                     ║
║                                                           ║
║     特性：                                                 ║
║     ✅ 智能AI引擎（带多种搜索优化）                          ║
║     ✅ 完整的中国象棋规则                                   ║
║     ✅ 支持自博弈训练                                      ║
║     ✅ 轻量级设计，CPU友好                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"""
        print(banner)
    
    def print_board(self):
        """打印当前棋盘状态"""
        self.clear_screen()
        
        # 显示游戏信息
        print("\n" + "="*50)
        print(f"第 {self.move_count + 1} 回合 | "
              f"{'红方回合' if self.board.current_turn == 'red' else '黑方回合'}")
        if self.board.is_in_check(self.board.current_turn):
            print("⚠️  将军！")
        print("="*50 + "\n")
        
        # 打印棋盘
        print(self.board.display())
    
    def parse_move_input(self, input_str: str) -> Optional[Move]:
        """
        解析用户的走法输入
        
        支持的格式：
        - "e2e4" 或 "e2-e4"：坐标格式（列行->列行）
        - 中国象棋记谱法（简化版）
        
        返回：Move对象或None（如果输入无效）
        """
        input_str = input_str.strip().lower().replace('-', '').replace(' ', '')
        
        if len(input_str) != 4:
            return None
        
        try:
            from_col = ord(input_str[0]) - ord('a')
            from_row = 10 - int(input_str[1])
            to_col = ord(input_str[2]) - ord('a')
            to_row = 10 - int(input_str[3])
            
            if not (0 <= from_col < 9 and 0 <= to_col < 9 and
                    0 <= from_row < 10 and 0 <= to_row < 10):
                return None
            
            from_pos = (from_row, from_col)
            to_pos = (to_row, to_col)
            
            # 验证走法合法性
            piece = self.board.get_piece_at(*from_pos)
            if not piece or piece.color != self.human_color:
                return None
            
            # 检查是否在合法走法列表中
            legal_moves = self.board.get_legal_moves(self.human_color)
            for move in legal_moves:
                if move.from_pos == from_pos and move.to_pos == to_pos:
                    return move
            
            return None
            
        except (ValueError, IndexError):
            return None
    
    def get_human_move(self) -> Optional[Move]:
        """
        获取人类玩家的走法输入
        """
        print("\n" + "-"*50)
        print("请输入你的走法（格式示例：h2h3 表示从h2移动到h3）")
        print("输入 'help' 查看帮助，'quit' 退出游戏")
        print("-"*50)
        
        while True:
            try:
                user_input = input("🎯 你的走法: ").strip()
                
                if user_input.lower() == 'quit':
                    return None
                
                if user_input.lower() == 'help':
                    self.print_help()
                    continue
                
                if user_input.lower() == 'show':
                    self.print_board()
                    continue
                
                if user_input.lower() == 'moves':
                    self.show_legal_moves()
                    continue
                
                move = self.parse_move_input(user_input)
                
                if move:
                    return move
                else:
                    print("❌ 无效的走法！请重新输入。")
                    print("   格式: 起始位置 + 目标位置 (如 h2h3)")
                    
            except EOFError:
                return None
            except KeyboardInterrupt:
                print("\n")
                return None
    
    def print_help(self):
        """打印帮助信息"""
        help_text = """
📖 使用帮助：

【走法格式】
• 使用坐标表示法：列(字母) + 行(数字)
• 列：a-i (从左到右)
• 行：1-10 (从下到上)
• 示例：h2h3 表示将h2位置的棋子移动到h3

【特殊命令】
• help  - 显示此帮助信息
• show  - 刷新显示棋盘
• moves - 显示当前所有合法走法
• quit  - 退出游戏

【棋子符号】
红方：帥 仕 相 馬 車 炮 兵
黑方：將 士 象 馬 車 砲 卒

【提示】
• 红方先行（你执红棋）
• 输入坐标时注意行列范围
• 系统会自动检查走法合法性

【快捷键】
• Ctrl+C 可随时退出
"""
        print(help_text)
    
    def show_legal_moves(self):
        """显示当前所有合法走法"""
        color = self.board.current_turn
        legal_moves = self.board.get_legal_moves(color)
        
        print(f"\n{'='*50}")
        print(f"{color} 方的所有合法走法 ({len(legal_moves)}个):")
        print('='*50)
        
        for i, move in enumerate(legal_moves, 1):
            piece = self.board.get_piece_at(*move.from_pos)
            piece_name = piece.piece_type if piece else '?'
            
            capture_info = f" 吃{move.captured}" if move.captured else ""
            print(f"  {i:3d}. {move} [{piece_name}]{capture_info}")
        
        print('='*50)
    
    def play_human_vs_ai(self):
        """
        人机对战模式
        """
        self.print_banner()
        
        print("\n🎮 人机对战模式")
        print("="*50)
        print(f"你执: {'红方 (先手)' if self.human_color == 'red' else '黑方 (后手)'}")
        print(f"AI执: {'黑方 (后手)' if self.human_color == 'red' else '红方 (先手)'}")
        print(f"AI搜索深度: {self.ai.config['max_depth']}层")
        print("="*50)
        
        input("\n按回车键开始游戏...")
        
        while not self.game_over:
            self.print_board()
            
            # 判断当前是谁的回合
            if self.board.current_turn == self.human_color:
                # 人类回合
                move = self.get_human_move()
                
                if move is None:
                    # 用户选择退出
                    confirm = input("\n确定要退出吗？(y/n): ")
                    if confirm.lower() == 'y':
                        print("\n👋 游戏已退出。感谢游玩！")
                        break
                    continue
                
                # 执行人类走法
                success = self.board.make_move(move)
                if not success:
                    print("❌ 走法执行失败！")
                    continue
                
                self.move_count += 1
                print(f"\n✅ 你走了: {move}")
                
                # 检查游戏结束条件
                if self._check_game_end():
                    break
                
                time.sleep(0.5)  # 短暂暂停让玩家看到走法
            
            else:
                # AI回合
                print("\n🤔 AI正在思考...")
                
                start_time = time.time()
                result = self.ai.get_best_move(self.board)
                ai_time = time.time() - start_time
                
                if result.best_move:
                    # 执行AI走法
                    self.board.make_move(result.best_move)
                    self.move_count += 1
                    
                    print(f"\n🤖 AI走了: {result.best_move}")
                    print(f"   思考时间: {ai_time:.2f}秒")
                    print(f"   搜索节点数: {result.nodes_searched:,}")
                    print(f"   评估分数: {result.score:+.1f}")
                    
                    # 检查游戏结束条件
                    if self._check_game_end():
                        break
                else:
                    print("\n⚠️  AI无法找到合法走法！")
                    break
                
                time.sleep(1.0)  # 让玩家看清AI的走法
    
    def play_ai_vs_ai(self, num_games: int = 1, delay: float = 1.0):
        """
        AI对弈模式（观看两AI对战）
        
        参数：
        - num_games: 对弈局数
        - delay: 每步之间的延迟（秒）
        """
        self.print_banner()
        
        print(f"\n🤖 AI对弈模式")
        print("="*50)
        print(f"红方AI vs 黑方AI")
        print(f"搜索深度: {self.ai.config['max_depth']}层")
        print(f"对弈局数: {num_games}")
        print("="*50)
        
        input("\n按回车键开始观看...\n")
        
        for game_num in range(num_games):
            print(f"\n{'='*60}")
            print(f"📊 第 {game_num + 1}/{num_games} 局")
            print('='*60)
            
            self.board = Board()
            self.move_count = 0
            self.game_over = False
            
            max_moves = 200  # 最大步数限制
            
            for move_num in range(max_moves):
                self.print_board()
                
                # 检查游戏是否结束
                if self._check_game_end():
                    break
                
                current_color = self.board.current_turn
                color_name = '红方' if current_color == 'red' else '黑方'
                
                print(f"\n⏳ {color_name}AI思考中...")
                
                start_time = time.time()
                result = self.ai.get_best_move(self.board)
                think_time = time.time() - start_time
                
                if result.best_move:
                    self.board.make_move(result.best_move)
                    self.move_count += 1
                    
                    print(f"\n✅ {color_name}AI走了: {result.best_move}")
                    print(f"   思考时间: {think_time:.2f}s | "
                          f"节点数: {result.nodes_searched:,} | "
                          f"评分: {result.score:+.1f}")
                    
                    time.sleep(delay)
                else:
                    print(f"\n❌ {color_name}AI无合法走法！")
                    break
            
            if self.move_count >= max_moves:
                print(f"\n🤝 达到最大步数限制({max_moves}步)，判定为和棋")
            
            # 询问是否继续下一局
            if game_num < num_games - 1:
                cont = input("\n是否继续下一局？(y/n): ")
                if cont.lower() != 'y':
                    break
    
    def _check_game_end(self) -> bool:
        """检查游戏是否结束并打印结果"""
        red_in_checkmate = self.board.is_checkmate('red')
        black_in_checkmate = self.board.is_checkmate('black')
        
        if red_in_checkmate:
            self.print_board()
            print("\n" + "="*50)
            print("🏆 游戏结束！")
            print("="*50)
            print("   黑方获胜！（红方被将死）")
            print(f"   总步数: {self.move_count}")
            print("="*50 + "\n")
            self.game_over = True
            return True
        
        if black_in_checkmate:
            self.print_board()
            print("\n" + "="*50)
            print("🏆 游戏结束！")
            print("="*50)
            print("   红方获胜！（黑方被将死）")
            print(f"   总步数: {self.move_count}")
            print("="*50 + "\n")
            self.game_over = True
            return True
        
        # 检查困毙（无子可动且未被将军）
        red_moves = len(self.board.get_legal_moves('red'))
        black_moves = len(self.board.get_legal_moves('black'))
        
        if (self.board.current_turn == 'red' and red_moves == 0 and 
            not self.board.is_in_check('red')):
            self.print_board()
            print("\n" + "="*50)
            print("🤝 游戏结束！")
            print("="*50)
            print("   和棋！（红方困毙）")
            print("="*50 + "\n")
            self.game_over = True
            return True
        
        if (self.board.current_turn == 'black' and black_moves == 0 and 
            not self.board.is_in_check('black')):
            self.print_board()
            print("\n" + "="*50)
            print("🤝 游戏结束！")
            print("="*50)
            print("   和棋！（黑方困毙）")
            print("="*50 + "\n")
            self.game_over = True
            return True
        
        return False


def main_menu():
    """主菜单"""
    cli = ChessCLI()
    
    while True:
        cli.clear_screen()
        cli.print_banner()
        
        print("\n请选择模式：\n")
        print("  1. 🎮 人机对战（你 vs AI）")
        print("  2. 🤖 AI对弈（观看两AI对战）")
        print("  3. 📚 训练AI（自博弈学习）")
        print("  4. ❌ 退出\n")
        
        try:
            choice = input("请输入选项 (1-4): ").strip()
            
            if choice == '1':
                cli.play_human_vs_ai()
                input("\n按回车键返回主菜单...")
            
            elif choice == '2':
                try:
                    games = int(input("请输入对弈局数 (默认1): ") or "1")
                    delay = float(input("每步延迟秒数 (默认1.0): ") or "1.0")
                    cli.play_ai_vs_ai(num_games=games, delay=delay)
                except ValueError:
                    print("❌ 输入无效！使用默认值。")
                    cli.play_ai_vs_ai()
                input("\n按回车键返回主菜单...")
            
            elif choice == '3':
                try:
                    epochs = int(input("请输入训练轮数 (默认50): ") or "50")
                    games_per_epoch = int(input("每轮游戏数 (默认10): ") or "10")
                    
                    print(f"\n开始训练：{epochs}轮，每轮{games_per_epoch}局...")
                    trainer = SelfPlayTrainer()
                    trainer.train(num_epochs=epochs, verbose=True)
                    
                except ValueError:
                    print("❌ 输入无效！")
                
                input("\n按回车键返回主菜单...")
            
            elif choice == '4':
                print("\n👋 感谢使用中国象棋AI系统！再见！")
                break
            
            else:
                print("\n❌ 无效选项，请重新选择。")
                time.sleep(1)
        
        except KeyboardInterrupt:
            print("\n\n👋 再见！")
            break
        except Exception as e:
            print(f"\n❌ 发生错误: {e}")
            input("\n按回车键继续...")


if __name__ == '__main__':
    main_menu()
