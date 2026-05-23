# -*- coding: utf-8 -*-
"""
中国象棋 - 走法生成器

优化走法生成顺序以提高Alpha-Beta剪枝效率
"""
from typing import List, Tuple
from .board import Board
from .pieces import Move


class MoveGenerator:
    """走法生成器 - 带排序优化"""
    
    def __init__(self):
        # 杀手步法表（每层深度存储2个最佳步法）
        self.killer_moves = [[None, None] for _ in range(64)]
        
        # 历史启发表（记录每个走法的成功次数）
        self.history_table = {}
    
    def generate_moves(self, board: Board, color: str) -> List[Move]:
        """
        生成所有合法走法并按优先级排序
        
        排序策略：
        1. 吃子走法优先（按被吃棋子价值排序）
        2. 杀手步法
        3. 历史启发高分走法
        """
        legal_moves = board.get_legal_moves(color)
        
        if not legal_moves:
            return []
        
        # 为每个走法计算得分
        scored_moves = []
        for move in legal_moves:
            score = self._calculate_move_score(move, board)
            scored_moves.append((score, move))
        
        # 按得分降序排列
        scored_moves.sort(key=lambda x: x[0], reverse=True)
        
        return [move for _, move in scored_moves]
    
    def _calculate_move_score(self, move: Move, board: Board) -> int:
        """
        计算走法的启发式分数
        分数越高，越应该先搜索
        """
        score = 0
        
        # 1. 吃子得分（MVV-LVA: Most Valuable Victim - Least Valuable Attacker）
        if move.captured:
            piece_values = {
                'KING': 10000, 'ADVISOR': 200, 'ELEPHANT': 200,
                'HORSE': 400, 'CHARIOT': 900, 'CANNON': 450, 'PAWN': 100
            }
            
            victim_value = piece_values.get(move.captured, 0)
            
            # 获取攻击者类型
            attacker = board.get_piece_at(*move.from_pos)
            attacker_value = piece_values.get(attacker.piece_type, 0) if attacker else 0
            
            # MVV-LVA：高价值目标 + 低价值攻击者优先
            score += victim_value * 10 - attacker_value
        
        # 2. 杀手步法加分
        # （在search模块中设置depth参数后使用）
        
        # 3. 历史启发得分
        move_key = (move.from_pos, move.to_pos)
        history_score = self.history_table.get(move_key, 0)
        score += history_score
        
        return score
    
    def update_killer_move(self, depth: int, move: Move):
        """更新杀手步法表"""
        if depth < len(self.killer_moves):
            # 如果不是重复的走法，则添加
            if self.killer_moves[depth][0] != move:
                self.killer_moves[depth][1] = self.killer_moves[depth][0]
                self.killer_moves[depth][0] = move
    
    def update_history(self, move: Move, depth: int):
        """更新历史启发表"""
        move_key = (move.from_pos, move.to_pos)
        # 深度越大，权重越高（深层的最佳走法更重要）
        bonus = depth * depth
        current_score = self.history_table.get(move_key, 0)
        self.history_table[move_key] = current_score + bonus
    
    def order_moves_for_search(self, moves: List[Move], board: Board, 
                                depth: int = 0, tt_best_move: Move = None) -> List[Move]:
        """
        专门为搜索算法排序走法
        优先级：
        1. 置换表最佳走法
        2. 吃子走法（MVV-LVA排序）
        3. 杀手步法
        4. 历史启发走法
        """
        def get_move_priority(move):
            priority = 0
            
            # 置换表最佳走法最高优先级
            if tt_best_move and move.from_pos == tt_best_move.from_pos and \
               move.to_pos == tt_best_move.to_pos:
                priority += 1000000
            
            # 吃子走法
            if move.captured:
                piece_values = {
                    'KING': 10000, 'CHARIOT': 900, 'CANNON': 450,
                    'HORSE': 400, 'PAWN': 100, 'ADVISOR': 20, 'ELEPHANT': 20
                }
                victim_value = piece_values.get(move.captured, 0)
                priority += 100000 + victim_value * 10
            
            # 杀手步法
            if depth < len(self.killer_moves):
                if self.killer_moves[depth][0] == move:
                    priority += 50000
                elif self.killer_moves[depth][1] == move:
                    priority += 40000
            
            # 历史启发
            move_key = (move.from_pos, move.to_pos)
            history_score = self.history_table.get(move_key, 0)
            priority += history_score
            
            return priority
        
        return sorted(moves, key=get_move_priority, reverse=True)


def generate_all_legal_moves(board: Board, color: str) -> List[Move]:
    """便捷函数：生成所有合法走法（无排序）"""
    generator = MoveGenerator()
    return generator.generate_moves(board, color)
