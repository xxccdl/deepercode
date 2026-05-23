# -*- coding: utf-8 -*-
"""
中国象棋 - 自博弈训练系统

通过AI自我对弈来优化评估函数权重，无需人工标注数据。
使用轻量级强化学习方法（适合CPU环境）。
"""
import random
import time
import json
import os
import sys
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass, field
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.board import Board
from core.pieces import Move
from core.evaluator import Evaluator
from search.alphabeta import ChessAI
from config import TRAINING_CONFIG


@dataclass
class Experience:
    """单条经验样本"""
    board_state_hash: int      # 棋盘状态哈希
    move: Move                 # 选择的走法
    reward: float              # 获得的奖励
    next_state_hash: int       # 下一状态哈希
    done: bool                # 是否终局


@dataclass
class GameResult:
    """一局游戏的结果"""
    winner: str               # 'red', 'black', 'draw'
    total_moves: int          # 总步数
    move_history: List[Move]  # 走法历史
    final_board: Board        # 最终棋盘状态
    duration: float           # 对局时长（秒）


class ExperienceReplayBuffer:
    """经验回放缓冲区 - 存储和采样训练样本"""
    
    def __init__(self, capacity: int = 10000):
        self.buffer = deque(maxlen=capacity)
    
    def add(self, experience: Experience):
        """添加一条经验"""
        self.buffer.append(experience)
    
    def sample(self, batch_size: int) -> List[Experience]:
        """随机采样一批经验"""
        if len(self.buffer) < batch_size:
            return list(self.buffer)
        
        return random.sample(list(self.buffer), batch_size)
    
    def __len__(self):
        return len(self.buffer)


class SelfPlayTrainer:
    """
    自博弈训练器
    
    核心思想：
    1. AI与自己对弈多局游戏
    2. 记录每一步的决策和最终结果
    3. 根据胜负结果调整评估函数权重
    4. 迭代优化，使AI越来越强
    
    特点：
    - CPU友好：不需要深度神经网络
    - 轻量级：只调整评估函数的线性权重
    - 稳定性高：基于成熟的Alpha-Beta搜索框架
    """
    
    def __init__(self, config: dict = None):
        self.config = config or TRAINING_CONFIG.copy()
        
        # 初始化AI引擎（用于生成对局数据）
        self.ai_engine = ChessAI(max_depth=3)  # 训练时使用较浅深度以加快速度
        
        # 经验回放缓冲区
        self.experience_buffer = ExperienceReplayBuffer(
            capacity=self.config['experience_replay_size']
        )
        
        # 训练统计
        self.training_stats = {
            'total_games': 0,
            'red_wins': 0,
            'black_wins': 0,
            'draws': 0,
            'current_epoch': 0,
            'best_win_rate': 0.0,
            'weight_history': [],
        }
        
        # 探索率（epsilon-greedy策略）
        self.epsilon = self.config['exploration_rate']
    
    def play_self_game(self, max_moves: int = 200, verbose: bool = False) -> GameResult:
        """
        进行一局自博弈游戏
        
        参数：
        - max_moves: 最大步数（防止无限循环）
        - verbose: 是否打印详细信息
        
        返回：GameResult对象
        """
        board = Board()
        move_history = []
        game_experiences = []
        start_time = time.time()
        
        current_color = 'red'  # 红方先行
        
        for move_num in range(max_moves):
            # 检查是否结束
            if board.is_checkmate('red'):
                result = GameResult(
                    winner='black',
                    total_moves=len(move_history),
                    move_history=move_history,
                    final_board=board.clone(),
                    duration=time.time() - start_time
                )
                
                # 为所有经验分配奖励
                self._assign_rewards(game_experiences, -1.0)
                
                if verbose:
                    print(f"\n游戏结束！黑方获胜（{len(move_history)}步）")
                
                return result
            
            if board.is_checkmate('black'):
                result = GameResult(
                    winner='red',
                    total_moves=len(move_history),
                    move_history=move_history,
                    final_board=board.clone(),
                    duration=time.time() - start_time
                )
                
                self._assign_rewards(game_experiences, 1.0)
                
                if verbose:
                    print(f"\n游戏结束！红方获胜（{len(move_steps)}步）")
                
                return result
            
            # AI选择走法
            best_move = self._select_move_with_exploration(board)
            
            if not best_move:
                # 无合法走法（困毙）
                result = GameResult(
                    winner='black' if current_color == 'red' else 'red',
                    total_moves=len(move_history),
                    move_history=move_history,
                    final_board=board.clone(),
                    duration=time.time() - start_time
                )
                
                reward = -1.0 if current_color == 'red' else 1.0
                self._assign_rewards(game_experiences, reward)
                
                return result
            
            # 记录经验
            state_hash = hash(str(board.grid))
            
            # 执行走法
            board.make_move(best_move)
            next_state_hash = hash(str(board.grid))
            
            experience = Experience(
                board_state_hash=state_hash,
                move=best_move,
                reward=0.0,  # 稍后根据结果分配
                next_state_hash=next_state_hash,
                done=False
            )
            game_experiences.append(experience)
            move_history.append(best_move)
            
            if verbose and move_num % 10 == 0:
                print(f"第{move_num + 1}步: {current_color} -> {best_move}")
            
            # 切换回合
            current_color = 'black' if current_color == 'red' else 'red'
        
        # 达到最大步数，判定为和棋
        result = GameResult(
            winner='draw',
            total_moves=len(move_history),
            move_history=move_history,
            final_board=board.clone(),
            duration=time.time() - start_time
        )
        
        self._assign_rewards(game_experiences, 0.0)  # 和棋奖励为0
        
        if verbose:
            print(f"\n游戏结束！和棋（达到最大步数{max_moves}）")
        
        return result
    
    def _select_move_with_exploration(self, board: Board) -> Optional[Move]:
        """
        使用epsilon-greedy策略选择走法
        - 以epsilon概率随机探索
        - 以(1-epsilon)概率选择最佳走法
        """
        if random.random() < self.epsilon:
            # 随机探索：从合法走法中随机选一个
            legal_moves = board.get_legal_moves(board.current_turn)
            if legal_moves:
                return random.choice(legal_moves)
            return None
        else:
            # 利用：使用AI引擎选择最佳走法
            search_result = self.ai_engine.get_best_move(board)
            return search_result.best_move
    
    def _assign_rewards(self, experiences: List[Experience], outcome_reward: float):
        """
        分配奖励（使用折扣因子进行时间信用分配）
        
        参数：
        - experiences: 一局游戏中收集的所有经验
        - outcome_reward: 游戏最终结果（红胜=+1, 黑胜=-1, 和棋=0）
        """
        n = len(experiences)
        discount = self.config['discount_factor']
        
        for i, exp in enumerate(experiences):
            # 时间信用分配：越接近结局的步骤获得越多信用
            steps_to_end = n - i
            discounted_reward = outcome_reward * (discount ** steps_to_end)
            exp.reward = discounted_reward
            exp.done = (i == n - 1)
            
            # 加入经验回放缓冲区
            self.experience_buffer.add(exp)
    
    def train_epoch(self, epoch_num: int, games_per_epoch: int = None,
                   verbose: bool = True) -> Dict:
        """
        训练一个epoch（进行多局游戏并更新权重）
        
        参数：
        - epoch_num: 当前epoch编号
        - games_per_epoch: 每个epoch进行的游戏数量
        - verbose: 是否打印进度信息
        
        返回：训练统计信息
        """
        if games_per_epoch is None:
            games_per_epoch = self.config['games_per_epoch']
        
        epoch_start = time.time()
        epoch_red_wins = 0
        epoch_black_wins = 0
        epoch_draws = 0
        
        print(f"\n{'='*60}")
        print(f"Epoch {epoch_num + 1}/{self.config['epochs']}")
        print(f"探索率: {self.epsilon:.4f}")
        print(f"{'='*60}\n")
        
        for game_idx in range(games_per_epoch):
            if verbose:
                print(f"--- 游戏 {game_idx + 1}/{games_per_epoch} ---")
            
            # 进行一局自博弈
            result = self.play_self_game(verbose=False)
            
            # 更新统计
            self.training_stats['total_games'] += 1
            
            if result.winner == 'red':
                epoch_red_wins += 1
                self.training_stats['red_wins'] += 1
            elif result.winner == 'black':
                epoch_black_wins += 1
                self.training_stats['black_wins'] += 1
            else:
                epoch_draws += 1
                self.training_stats['draws'] += 1
            
            if verbose and (game_idx + 1) % 5 == 0:
                red_rate = epoch_red_wins / (game_idx + 1) * 100
                black_rate = epoch_black_wins / (game_idx + 1) * 100
                draw_rate = epoch_draws / (game_idx + 1) * 100
                print(f"当前战绩: 红{epoch_red_wins}胜 黑{epoch_black_wins}胜 和{epoch_draws} | "
                      f"胜率 红:{red_rate:.1f}% 黑:{black_rate:.1f}% 和:{draw_rate:.1f}%")
        
        # 从经验中学习并更新权重
        weight_updates = self._update_weights_from_experience()
        
        # 更新探索率（衰减）
        self.epsilon = max(
            self.config['min_exploration_rate'],
            self.epsilon * self.config['exploration_decay']
        )
        
        # 计算epoch统计
        epoch_duration = time.time() - epoch_start
        win_rate_red = epoch_red_wins / games_per_epoch * 100
        
        stats = {
            'epoch': epoch_num + 1,
            'games_played': games_per_epoch,
            'red_wins': epoch_red_wins,
            'black_wins': epoch_black_wins,
            'draws': epoch_draws,
            'win_rate_red': f"{win_rate_red:.2f}%",
            'exploration_rate': f"{self.epsilon:.4f}",
            'duration': f"{epoch_duration:.2f}s",
            'weight_updates': weight_updates,
        }
        
        self.training_stats['current_epoch'] = epoch_num + 1
        
        # 保存最佳模型
        if win_rate_red > self.training_stats['best_win_rate']:
            self.training_stats['best_win_rate'] = win_rate_red
            self.save_model('best_model.json')
            if verbose:
                print(f"\n🎉 新的最佳模型！红方胜率: {win_rate_red:.2f}%")
        
        # 打印epoch总结
        if verbose:
            print(f"\n--- Epoch {epoch_num + 1} 总结 ---")
            print(f"总游戏数: {games_per_epoch}")
            print(f"红方胜利: {epoch_red_wins} ({epoch_red_wins/games_per_epoch*100:.1f}%)")
            print(f"黑方胜利: {epoch_black_wins} ({epoch_black_wins/games_per_epoch*100:.1f}%)")
            print(f"和棋: {epoch_draws} ({epoch_draws/games_per_epoch*100:.1f}%)")
            print(f"用时: {epoch_duration:.2f}秒")
            print(f"权重更新: {weight_updates}")
        
        return stats
    
    def _update_weights_from_experience(self) -> Dict[str, float]:
        """
        从经验回放缓冲区中学习并更新评估函数权重
        
        使用简单的梯度下降方法：
        - 对于导致好结果的局面特征，增加其权重
        - 对于导致坏结果的局面特征，降低其权重
        """
        if len(self.experience_buffer) < self.config['batch_size']:
            return {}
        
        # 采样一批经验
        batch = self.experience_buffer.sample(self.config['batch_size'])
        
        # 计算每个维度的权重调整量
        weight_deltas = {
            'material': 0.0,
            'position': 0.0,
            'mobility': 0.0,
            'protection': 0.0,
            'center_control': 0.0,
        }
        
        learning_rate = self.config['learning_rate']
        
        for exp in batch:
            # 根据奖励方向调整权重
            # 正奖励（赢）：增加当前评估特征的权重
            # 负奖励（输）：减少当前评估特征的权重
            
            delta = learning_rate * exp.reward
            
            # 简化的权重更新规则（基于领域知识）
            if exp.reward > 0.3:  # 明显的好结果
                weight_deltas['material'] += delta * 0.4
                weight_deltas['position'] += delta * 0.25
                weight_deltas['mobility'] += delta * 0.15
                weight_deltas['protection'] += delta * 0.1
                weight_deltas['center_control'] += delta * 0.1
            elif exp.reward < -0.3:  # 明显的坏结果
                weight_deltas['material'] -= abs(delta) * 0.35
                weight_deltas['position'] -= abs(delta) * 0.25
                weight_deltas['mobility'] -= abs(delta) * 0.2
                weight_deltas['protection'] -= abs(delta) * 0.1
                weight_deltas['center_control'] -= abs(delta) * 0.1
        
        # 应用权重更新
        self.ai_engine.evaluator.update_weights_from_training(weight_deltas)
        
        return weight_deltas
    
    def train(self, num_epochs: int = None, verbose: bool = True) -> List[Dict]:
        """
        完整的训练流程
        
        参数：
        - num_epochs: 训练轮数
        - verbose: 是否打印详细信息
        
        返回：所有epoch的统计列表
        """
        if num_epochs is None:
            num_epochs = self.config['epochs']
        
        all_stats = []
        
        print("\n" + "="*60)
        print("开始中国象棋AI自博弈训练")
        print("="*60)
        print(f"训练轮数: {num_epochs}")
        print(f"每轮游戏数: {self.config['games_per_epoch']}")
        print(f"初始探索率: {self.epsilon}")
        print(f"学习率: {self.config['learning_rate']}")
        print("="*60)
        
        training_start = time.time()
        
        for epoch in range(num_epochs):
            epoch_stats = self.train_epoch(epoch, verbose=verbose)
            all_stats.append(epoch_stats)
            
            # 定期保存检查点
            if (epoch + 1) % 10 == 0:
                self.save_model(f'checkpoint_epoch_{epoch + 1}.json')
                if verbose:
                    print(f"\n💾 已保存检查点: checkpoint_epoch_{epoch + 1}.json")
        
        total_training_time = time.time() - training_start
        
        # 保存最终模型
        self.save_model('final_model.json')
        
        # 打印最终统计
        print("\n" + "="*60)
        print("训练完成！")
        print("="*60)
        print(f"总训练时间: {total_training_time:.2f}秒 ({total_training_time/60:.1f}分钟)")
        print(f"总游戏数: {self.training_stats['total_games']}")
        print(f"红方总胜利: {self.training_stats['red_wins']} "
              f"({self.training_stats['red_wins']/max(1,self.training_stats['total_games'])*100:.1f}%)")
        print(f"黑方总胜利: {self.training_stats['black_wins']} "
              f"({self.training_stats['black_wins']/max(1,self.training_stats['total_games'])*100:.1f}%)")
        print(f"和棋次数: {self.training_stats['draws']} "
              f"({self.training_stats['draws']/max(1,self.training_stats['total_games'])*100:.1f}%)")
        print(f"最佳红方胜率: {self.training_stats['best_win_rate']:.2f}%")
        print(f"最终探索率: {self.epsilon:.6f}")
        print("模型已保存到: final_model.json")
        print("="*60 + "\n")
        
        return all_stats
    
    def save_model(self, filepath: str):
        """
        保存模型参数（评估函数权重）
        """
        model_data = {
            'evaluator_weights': self.ai_engine.evaluator.learnable_weights.copy(),
            'training_stats': self.training_stats.copy(),
            'exploration_rate': self.epsilon,
            'config': self.config,
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(model_data, f, ensure_ascii=False, indent=2)
    
    def load_model(self, filepath: str):
        """
        加载模型参数
        """
        if not os.path.exists(filepath):
            print(f"⚠️  模型文件不存在: {filepath}")
            return False
        
        with open(filepath, 'r', encoding='utf-8') as f:
            model_data = json.load(f)
        
        # 恢复权重
        if 'evaluator_weights' in model_data:
            self.ai_engine.evaluator.learnable_weights.update(
                model_data['evaluator_weights']
            )
        
        # 恢复训练状态
        if 'training_stats' in model_data:
            self.training_stats.update(model_data['training_stats'])
        
        if 'exploration_rate' in model_data:
            self.epsilon = model_data['exploration_rate']
        
        print(f"✅ 成功加载模型: {filepath}")
        return True


def train_ai_command(num_epochs: int = 50, games_per_epoch: int = 10):
    """
    命令行入口：训练AI
    """
    trainer = SelfPlayTrainer()
    
    try:
        stats = trainer.train(num_epochs=num_epochs, verbose=True)
        return stats
    except KeyboardInterrupt:
        print("\n\n⚠️  训练被用户中断")
        trainer.save_model('interrupted_model.json')
        print("已保存当前进度到: interrupted_model.json")
        return None
