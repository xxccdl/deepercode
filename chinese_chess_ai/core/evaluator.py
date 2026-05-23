# -*- coding: utf-8 -*-
"""
中国象棋 - 局面评估器

基于多维度特征的综合评估：
1. 棋子价值（Material）
2. 位置价值（Position Value / Piece-Square Tables）
3. 机动性（Mobility）
4. 棋子保护与威胁（Protection & Threats）
5. 中心控制（Center Control）
"""
import numpy as np
from typing import Dict, Tuple
from .board import Board
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import EVALUATOR_CONFIG


class Evaluator:
    """局面评估器 - 返回从当前走子方视角的分数"""
    
    def __init__(self):
        self.config = EVALUATOR_CONFIG
        self.piece_values = self.config['piece_values']
        
        # 初始化位置价值表（Piece-Square Tables, PST）
        # 这些表格反映了每个位置对不同棋子的战略价值
        self._init_position_tables()
        
        # 可学习的权重（用于自博弈优化）
        self.learnable_weights = {
            'material': 1.0,
            'position': self.config['position_weight'],
            'mobility': self.config['mobility_weight'],
            'protection': self.config['protection_weight'],
            'center_control': self.config['center_control_weight'],
        }
    
    def _init_position_tables(self):
        """
        初始化位置价值表（PST）
        表格是从黑方视角定义的，红方需要翻转使用
        """
        
        # 将/帅的位置价值（九宫格内）
        self.king_pst = [
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   2,   0,   0,   0,   0],
            [  0,   0,   0,   0,  10,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
        ]
        
        # 士/仕的位置价值
        self.advisor_pst = [
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,  20,   0,  20,   0,   0,   0],
            [  0,   0,   0,   0,  22,   0,   0,   0,   0],
            [  0,   0,   0,  23,   0,  23,   0,   0,   0],
        ]
        
        # 象/相的位置价值
        self.elephant_pst = [
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,  15,   0,   0,   0,  15,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,  18,   0,   0,   0,   0,   0,  18,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
        ]
        
        # 马的位置价值
        self.horse_pst = [
            [  4,   8,  16,  12,   4,  12,  16,   8,   4],
            [  4,  10,  28,  16,   8,  16,  28,  10,   4],
            [ 12,  14,  16,  20,  18,  20,  16,  14,  12],
            [  8,  24,  26,  24,  28,  24,  26,  24,   8],
            [  6,  32,  38,  36,  34,  36,  38,  32,   6],
            [  6,  32,  38,  36,  34,  36,  38,  32,   6],
            [  8,  24,  26,  24,  28,  24,  26,  24,   8],
            [ 12,  14,  16,  20,  18,  20,  16,  14,  12],
            [  4,  10,  28,  16,   8,  16,  28,  10,   4],
            [  4,   8,  16,  12,   4,  12,  16,   8,   4],
        ]
        
        # 车的位置价值
        self.chariot_pst = [
            [ 14,  14,  12,  18,  16,  18,  12,  14,  14],
            [ 16,  20,  18,  24,  26,  24,  18,  20,  16],
            [ 12,  12,  12,  18,  18,  18,  12,  12,  12],
            [ 12,  18,  16,  22,  22,  22,  16,  18,  12],
            [ 12,  14,  12,  18,  18,  18,  12,  14,  12],
            [ 12,  14,  12,  18,  18,  18,  12,  14,  12],
            [ 12,  18,  16,  22,  22,  22,  16,  18,  12],
            [ 12,  12,  12,  18,  18,  18,  12,  12,  12],
            [ 16,  20,  18,  24,  26,  24,  18,  20,  16],
            [ 14,  14,  12,  18,  16,  18,  12,  14,  14],
        ]
        
        # 炮的位置价值
        self.cannon_pst = [
            [  6,   4,   0, -10, -12, -10,   0,   4,   6],
            [  2,   2,   0,   -4,  -14,  -4,   0,   2,   2],
            [  2,   2,   0,  -10,  -8, -10,   0,   2,   2],
            [  0,   0,   2,   -4,  18,  -4,   2,   0,   0],
            [  0,   0,   4,   -2,   8,  -2,   4,   0,   0],
            [  0,   0,   4,   -2,   8,  -2,   4,   0,   0],
            [  0,   0,   2,   -4,  18,  -4,   2,   0,   0],
            [  2,   2,   0,  -10,  -8, -10,   0,   2,   2],
            [  2,   2,   0,   -4,  -14,  -4,   0,   2,   2],
            [  6,   4,   0, -10, -12, -10,   0,   4,   6],
        ]
        
        # 兵/卒的位置价值（过河前vs过河后）
        self.pawn_pst_black = [  # 黑方兵（向上移动，row增大方向为前进）
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  2,   0,   4,   0,   8,   0,   4,   0,   2],
            [  6,  12,  18,  18,  20,  18,  18,  12,   6],
            [ 10,  20,  30,  34,  40,  34,  30,  20,  10],
            [ 14,  26,  42,  60,  80,  60,  42,  26,  14],
            [ 18,  36,  56,  80, 120,  80,  56,  36,  18],
            [  6,   8,  12,  14,  16,  14,  12,   8,   6],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
        ]
        
        self.pawn_pst_red = [  # 红方兵（向下移动，row减小方向为前进）
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  6,   8,  12,  14,  16,  14,  12,   8,   6],
            [ 18,  36,  56,  80, 120,  80,  56,  36,  18],
            [ 14,  26,  42,  60,  80,  60,  42,  26,  14],
            [ 10,  20,  30,  34,  40,  34,  30,  20,  10],
            [  6,  12,  18,  18,  20,  18,  18,  12,   6],
            [  2,   0,   4,   0,   8,   0,   4,   0,   2],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
            [  0,   0,   0,   0,   0,   0,   0,   0,   0],
        ]
    
    def evaluate(self, board: Board) -> float:
        """
        评估整个局面
        
        返回值：
        正数：对当前走子方有利
        负数：对当前走子方不利
        """
        if board.is_checkmate(board.current_turn):
            return -99999  # 当前走子方被将死
        if board.is_checkmate('black' if board.current_turn == 'red' else 'red'):
            return 99999   # 对方被将死
        
        score = 0.0
        
        # 1. 材料评估（Material Evaluation）
        material_score = self._evaluate_material(board)
        score += material_score * self.learnable_weights['material']
        
        # 2. 位置评估（Positional Evaluation）
        position_score = self._evaluate_position(board)
        score += position_score * self.learnable_weights['position']
        
        # 3. 机动性评估（Mobility Evaluation）
        mobility_score = self._evaluate_mobility(board)
        score += mobility_score * self.learnable_weights['mobility']
        
        # 4. 保护与威胁评估（Protection & Threats）
        protection_score = self._evaluate_protection_threats(board)
        score += protection_score * self.learnable_weights['protection']
        
        # 5. 中心控制评估（Center Control）
        center_score = self._evaluate_center_control(board)
        score += center_score * self.learnable_weights['center_control']
        
        # 从当前走子方的角度返回分数
        return score if board.current_turn == 'red' else -score
    
    def _evaluate_material(self, board: Board) -> float:
        """评估材料价值（红方 - 黑方）"""
        red_material = 0.0
        black_material = 0.0
        
        for piece in board.get_all_pieces('red'):
            red_material += self.piece_values.get(piece.piece_type, 0)
        
        for piece in board.get_all_pieces('black'):
            black_material += self.piece_values.get(piece.piece_type, 0)
        
        return red_material - black_material
    
    def _evaluate_position(self, board: Board) -> float:
        """评估位置价值（Piece-Square Tables）"""
        red_position_value = 0.0
        black_position_value = 0.0
        
        pst_map = {
            'KING': self.king_pst,
            'ADVISOR': self.advisor_pst,
            'ELEPHANT': self.elephant_pst,
            'HORSE': self.horse_pst,
            'CHARIOT': self.chariot_pst,
            'CANNON': self.cannon_pst,
        }
        
        for piece in board.get_all_pieces('red'):
            row, col = piece.position
            pst = pst_map.get(piece.piece_type)
            
            if piece.piece_type == 'PAWN':
                pst = self.pawn_pst_red
            
            if pst:
                red_position_value += pst[row][col]
        
        for piece in board.get_all_pieces('black'):
            row, col = piece.position
            pst = pst_map.get(piece.piece_type)
            
            if piece.piece_type == 'PAWN':
                pst = self.pawn_pst_black
            
            if pst:
                black_position_value += pst[row][col]
        
        return red_position_value - black_position_value
    
    def _evaluate_mobility(self, board: Board) -> float:
        """评估机动性（可移动步数）"""
        red_moves = len(board.get_legal_moves('red'))
        black_moves = len(board.get_legal_moves('black'))
        
        return (red_moves - black_moves) * 2
    
    def _evaluate_protection_threats(self, board: Board) -> float:
        """评估棋子的保护与威胁关系"""
        score = 0.0
        
        # 计算每个棋子被保护和被威胁的次数
        for color in ['red', 'black']:
            pieces = board.get_all_pieces(color)
            enemy_color = 'black' if color == 'red' else 'red'
            enemy_pieces = board.get_all_pieces(enemy_color)
            
            for piece in pieces:
                protected_count = 0
                threatened_count = 0
                
                # 统计保护者（己方棋子能到达该位置的）
                for ally in pieces:
                    if ally.position != piece.position:
                        ally_moves = ally.get_possible_moves(board)
                        for move in ally_moves:
                            if move.to_pos == piece.position:
                                protected_count += 1
                
                # 统计威胁者（敌方棋子能到达该位置的）
                for enemy in enemy_pieces:
                    enemy_moves = enemy.get_possible_moves(board)
                    for move in enemy_moves:
                        if move.to_pos == piece.position:
                            threatened_count += 1
                
                # 计算该棋子的安全分
                piece_value = self.piece_values.get(piece.piece_type, 0)
                
                if color == 'red':
                    score += protected_count * 5  # 被保护加分
                    score -= threatened_count * (piece_value // 20)  # 被威胁扣分
                else:
                    score -= protected_count * 5
                    score += threatened_count * (piece_value // 20)
        
        return score
    
    def _evaluate_center_control(self, board: Board) -> float:
        """评估中心控制力"""
        # 定义中心区域（楚河汉界附近的中路区域）
        center_zone = [(4, c) for c in range(3, 6)] + [(5, c) for c in range(3, 6)]
        
        red_control = 0
        black_control = 0
        
        for pos in center_zone:
            row, col = pos
            piece = board.get_piece_at(row, col)
            
            if piece:
                if piece.color == 'red':
                    red_control += 1
                else:
                    black_control += 1
        
        # 同时考虑能够攻击到中心的棋子
        for piece in board.get_all_pieces('red'):
            moves = piece.get_possible_moves(board)
            for move in moves:
                if move.to_pos in center_zone or \
                   (move.to_pos[0] in [4, 5] and 3 <= move.to_pos[1] <= 5):
                    red_control += 0.5
        
        for piece in board.get_all_pieces('black'):
            moves = piece.get_possible_moves(board)
            for move in moves:
                if move.to_pos in center_zone or \
                   (move.to_pos[0] in [4, 5] and 3 <= move.to_pos[1] <= 5):
                    black_control += 0.5
        
        return (red_control - black_control) * 3
    
    def update_weights_from_training(self, weight_deltas: Dict[str, float]):
        """
        根据训练结果更新权重（自博弈学习）
        """
        for key, delta in weight_deltas.items():
            if key in self.learnable_weights:
                self.learnable_weights[key] += delta
                # 限制权重范围
                self.learnable_weights[key] = max(0.01, min(2.0, self.learnable_weights[key]))
