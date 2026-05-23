# -*- coding: utf-8 -*-
"""
中国象棋AI - 主入口

支持三种运行模式：
1. 人机对战 (vs)
2. AI训练 (train)
3. AI对弈观看 (watch)
"""
import argparse
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description='中国象棋智能对弈系统 - 基于Alpha-Beta搜索与自博弈学习',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法：
  python main.py --mode vs              # 人机对战模式
  python main.py --mode train           # AI训练模式（默认50轮）
  python main.py --mode train --epochs 100  # 训练100轮
  python main.py --mode watch           # 观看AI对弈
  python main.py --mode watch --games 5 # 观看5局AI对弈
        """
    )
    
    parser.add_argument(
        '--mode', '-m',
        choices=['vs', 'train', 'watch'],
        default='vs',
        help='运行模式: vs(人机对战), train(AI训练), watch(观看AI对弈)'
    )
    
    parser.add_argument(
        '--epochs', '-e',
        type=int,
        default=50,
        help='训练轮数（仅train模式有效，默认50）'
    )
    
    parser.add_argument(
        '--games', '-g',
        type=int,
        default=1,
        help='对弈局数（仅watch模式有效，默认1）'
    )
    
    parser.add_argument(
        '--depth', '-d',
        type=int,
        default=4,
        help='AI搜索深度（默认4，范围1-6）'
    )
    
    parser.add_argument(
        '--load-model',
        type=str,
        default=None,
        help='加载已训练的模型文件路径'
    )
    
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("🎮 中国象棋智能对弈系统 v1.0")
    print("="*60 + "\n")
    
    if args.mode == 'vs':
        from ui.cli import ChessCLI
        
        cli = ChessCLI()
        
        # 设置搜索深度
        cli.ai = __import__('search.alphabeta', fromlist=['ChessAI']).ChessAI(
            max_depth=args.depth
        )
        
        # 加载模型（如果指定）
        if args.load_model:
            from learning.trainer import SelfPlayTrainer
            trainer = SelfPlayTrainer()
            trainer.load_model(args.load_model)
            cli.ai.evaluator = trainer.ai_engine.evaluator
        
        cli.play_human_vs_ai()
    
    elif args.mode == 'train':
        from learning.trainer import train_ai_command
        
        print(f"📚 开始训练AI...")
        print(f"   训练轮数: {args.epochs}")
        print(f"   搜索深度: {args.depth}\n")
        
        train_ai_command(num_epochs=args.epochs)
    
    elif args.mode == 'watch':
        from ui.cli import ChessCLI
        
        cli = ChessCLI()
        cli.ai = __import__('search.alphabeta', fromlist=['ChessAI']).ChessAI(
            max_depth=args.depth
        )
        
        # 加载模型（如果指定）
        if args.load_model:
            from learning.trainer import SelfPlayTrainer
            trainer = SelfPlayTrainer()
            trainer.load_model(args.load_model)
            cli.ai.evaluator = trainer.ai_engine.evaluator
        
        cli.play_ai_vs_ai(num_games=args.games, delay=1.0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 程序被用户中断。再见！")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 程序出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
