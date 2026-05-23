# -*- coding: utf-8 -*-
"""
中国象棋 - Alpha-Beta 搜索算法

实现带多种优化的高效搜索：
- Alpha-Beta 剪枝
- 迭代加深（Iterative Deepening）
- 置换表（Transposition Table）
- 杀手步法（Killer Moves）
- 历史启发（History Heuristic）
- 空步裁剪（Null Move Pruning）
- 渴望窗口（Aspiration Windows）
"""
import time
import hashlib
from typing import Optional, Tuple, List
from dataclasses import dataclass
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.board import Board
from core.pieces import Move
from core.evaluator import Evaluator
from core.move_generator import MoveGenerator
from config import SEARCH_CONFIG


@dataclass
class SearchResult:
    """搜索结果"""
    best_move: Optional[Move]
    score: int
    depth: int
    nodes_searched: int
    search_time: float
    pv_line: List[Move]  # 主要变例（Principal Variation）


class TranspositionTableEntry:
    """置换表条目"""
    
    EXACT = 0      # 精确值
    LOWER = 1      # 下界（alpha剪枝）
    UPPER = 2      # 上界（beta剪枝）
    
    def __init__(self, hash_key: int, depth: int, score: int, 
                 flag: int, best_move: Move = None):
        self.hash_key = hash_key
        self.depth = depth
        self.score = score
        self.flag = flag
        self.best_move = best_move


class ChessAI:
    """中国象棋AI引擎"""
    
    def __init__(self, max_depth: int = None, evaluator: Evaluator = None):
        self.config = SEARCH_CONFIG.copy()
        
        if max_depth:
            self.config['max_depth'] = max_depth
        
        # 初始化组件
        self.evaluator = evaluator or Evaluator()
        self.move_generator = MoveGenerator()
        
        # 置换表（存储已计算的位置）
        self.tt_size = 1 << 20  # 1M个条目
        self.transposition_table: dict = {}
        
        # 统计信息
        self.nodes_searched = 0
        self.cutoffs_count = 0
        
        # Zobrist哈希种子（用于位置哈希）
        self._init_zobrist_keys()
    
    def _init_zobrist_keys(self):
        """初始化Zobrist哈希的随机键"""
        import random
        random.seed(42)  # 固定种子以确保可重复性
        
        # 为每个(棋子类型, 颜色, 位置)生成随机数
        self.zobrist_keys = {}
        piece_types = ['KING', 'ADVISOR', 'ELEPHANT', 'HORSE', 'CHARIOT', 'CANNON', 'PAWN']
        colors = ['red', 'black']
        
        for ptype in piece_types:
            for color in colors:
                for row in range(10):
                    for col in range(9):
                        self.zobrist_keys[(ptype, color, row, col)] = random.getrandbits(64)
        
        # 当前回合的Zobrist键
        self.zobrist_turn_key = random.getrandbits(64)
    
    def compute_hash(self, board: Board) -> int:
        """计算棋盘的Zobrist哈希值"""
        h = 0
        
        for piece in board.pieces.values():
            if piece.alive:
                row, col = piece.position
                key = self.zobrist_keys.get((piece.piece_type, piece.color, row, col), 0)
                h ^= key
        
        # 加入回合信息
        if board.current_turn == 'black':
            h ^= self.zobrist_turn_key
        
        return h
    
    def get_best_move(self, board: Board) -> SearchResult:
        """
        获取最佳走法（主入口）
        使用迭代加深搜索
        """
        start_time = time.time()
        self.nodes_searched = 0
        self.cutoffs_count = 0
        
        best_move = None
        best_score = 0
        final_pv = []
        
        max_depth = self.config['max_depth']
        time_limit = self.config['time_limit']
        
        # 迭代加深：从深度1开始逐步增加
        for depth in range(1, max_depth + 1):
            # 检查时间限制
            elapsed = time.time() - start_time
            if elapsed > time_limit * 0.8:  # 留出20%的余量
                break
            
            # 渐望窗口搜索（提高效率）
            if depth >= 3 and best_move:
                window = self.config['aspiration_window']
                result = self._search_with_aspiration(board, depth, 
                                                     best_score - window,
                                                     best_score + window,
                                                     start_time, time_limit)
                
                # 如果超出窗口，重新进行全窗口搜索
                if result.score <= best_score - window or result.score >= best_score + window:
                    result = self.alpha_beta_search(board, depth, start_time, time_limit)
            else:
                result = self.alpha_beta_search(board, depth, start_time, time_limit)
            
            if result.best_move:
                best_move = result.best_move
                best_score = result.score
                final_pv = result.pv_line
            
            # 如果找到将杀步法，可以提前结束
            if abs(best_score) > 90000:
                break
        
        search_time = time.time() - start_time
        
        return SearchResult(
            best_move=best_move,
            score=best_score,
           depth=depth if 'depth' in dir() else max_depth,
            nodes_searched=self.nodes_searched,
            search_time=search_time,
            pv_line=final_pv
        )
    
    def _search_with_aspiration(self, board: Board, depth: int, 
                                alpha: float, beta: float,
                                start_time: float, time_limit: float) -> SearchResult:
        """使用渴望窗口的搜索"""
        result = self._alphabeta_root(board, depth, alpha, beta, start_time, time_limit)
        return result
    
    def alpha_beta_search(self, board: Board, depth: int,
                          start_time: float, time_limit: float) -> SearchResult:
        """Alpha-Beta根节点搜索"""
        return self._alphabeta_root(board, depth, -float('inf'), float('inf'),
                                    start_time, time_limit)
    
    def _alphabeta_root(self, board: Board, depth: int, alpha: float, beta: float,
                        start_time: float, time_limit: float) -> SearchResult:
        """Alpha-Beta搜索的根节点"""
        best_move = None
        max_score = -float('inf')
        pv_line = []
        
        # 生成并排序所有合法走法
        color = board.current_turn
        legal_moves = self.move_generator.generate_moves(board, color)
        
        if not legal_moves:
            # 无合法走法
            if board.is_in_check(color):
                score = -99999 + (self.config['max_depth'] - depth)  # 被将死
            else:
                score = 0  # 和棋
            
            return SearchResult(
                best_move=None,
                score=score,
                depth=depth,
                nodes_searched=self.nodes_searched,
                search_time=time.time() - start_time,
                pv_line=[]
            )
        
        # 获取置换表建议的最佳走法
        tt_best_move = self._get_tt_move(board)
        
        # 对走法排序
        sorted_moves = self.move_generator.order_moves_for_search(
            legal_moves, board, depth, tt_best_move
        )
        
        for move in sorted_moves:
            # 时间检查
            if time.time() - start_time > time_limit:
                break
            
            # 执行走法
            board.make_move(move)
            
            # 递归搜索
            score = -self._alphabeta(board, depth - 1, -beta, -alpha,
                                     start_time, time_limit)
            
            # 撤销走法
            board.undo_move()
            
            self.nodes_searched += 1
            
            if score > max_score:
                max_score = score
                best_move = move
                pv_line = [move]  # 更新主要变例
                
                # 更新alpha值
                if score > alpha:
                    alpha = score
        
        # 将结果存入置换表
        board_hash = self.compute_hash(board)
        tt_entry = TranspositionTableEntry(
            hash_key=board_hash,
            depth=depth,
            score=max_score,
            flag=TranspositionTableEntry.EXACT,
            best_move=best_move
        )
        self.transposition_table[board_hash % self.tt_size] = tt_entry
        
        # 更新杀手步法和历史启发
        if best_move:
            self.move_generator.update_killer_move(depth, best_move)
            self.move_generator.update_history(best_move, depth)
        
        return SearchResult(
            best_move=best_move,
            score=max_score,
            depth=depth,
            nodes_searched=self.nodes_searched,
            search_time=time.time() - start_time,
            pv_line=pv_line
        )
    
    def _alphabeta(self, board: Board, depth: int, alpha: float, beta: float,
                   start_time: float, time_limit: float) -> float:
        """
        Alpha-Beta递归搜索函数（核心算法）
        
        参数：
        - board: 棋盘状态
        - depth: 剩余搜索深度
        - alpha: 当前最佳下界（最大化方保证能得到的最低分）
        - beta: 当前最佳上界（最小化方允许对手获得的最高分）
        """
        # 时间检查
        if self.nodes_searched % 1000 == 0 and time.time() - start_time > time_limit:
            return self.evaluator.evaluate(board)
        
        # 叶子节点：返回评估值
        if depth <= 0:
            return self._quiescence_search(board, alpha, beta, start_time, time_limit)
        
        # 查询置换表
        board_hash = self.compute_hash(board)
        tt_entry = self.transposition_table.get(board_hash % self.tt_size)
        tt_move = None
        
        if tt_entry and tt_entry.hash_key == board_hash and tt_entry.depth >= depth:
            if tt_entry.flag == TranspositionTableEntry.EXACT:
                return tt_entry.score
            elif tt_entry.flag == TranspositionTableEntry.LOWER:
                alpha = max(alpha, tt_entry.score)
            elif tt_entry.flag == TranspositionTableEntry.UPPER:
                beta = min(beta, tt_entry.score)
            
            if alpha >= beta:
                self.cutoffs_count += 1
                return tt_entry.score
            
            tt_move = tt_entry.best_move
        
        # 空步裁剪（Null Move Pruning）
        if (self.config['null_move_pruning'] and 
            depth >= 3 and 
            not board.is_in_check(board.current_turn)):
            
            # 让对手连走两步（减少一定深度）
            reduction = self.config['null_move_reduction']
            board.current_turn = 'black' if board.current_turn == 'red' else 'red'
            null_score = -self._alphabeta(board, depth - 1 - reduction, -beta, -beta + 1,
                                          start_time, time_limit)
            board.current_turn = 'red' if board.current_turn == 'black' else 'black'
            
            if null_score >= beta:
                self.cutoffs_count += 1
                return beta  # Beta剪枝
        
        # 生成合法走法
        color = board.current_turn
        legal_moves = self.move_generator.generate_moves(board, color)
        
        if not legal_moves:
            # 无合法走法
            if board.is_in_check(color):
                return -99999 + (self.config['max_depth'] - depth)  # 被将死
            else:
                return 0  # 和棋（困毙）
        
        # 排序走法
        sorted_moves = self.move_generator.order_moves_for_search(
            legal_moves, board, depth, tt_move
        )
        
        best_score = -float('inf')
        best_move = None
        tt_flag = TranspositionTableEntry.UPPER
        
        for move in sorted_moves:
            # 执行走法
            board.make_move(move)
            
            # 递归搜索（negamax框架：取负号并交换alpha/beta）
            score = -self._alphabeta(board, depth - 1, -beta, -alpha,
                                     start_time, time_limit)
            
            # 撤销走法
            board.undo_move()
            
            self.nodes_searched += 1
            
            if score > best_score:
                best_score = score
                best_move = move
                
                if score > alpha:
                    alpha = score
                    tt_flag = TranspositionTableEntry.EXACT
            
            # Alpha-Beta剪枝
            if alpha >= beta:
                self.cutoffs_count += 1
                
                # 更新杀手步法（非吃子走法才记录）
                if not move.captured:
                    self.move_generator.update_killer_move(depth, move)
                
                # 更新历史启发
                self.move_generator.update_history(move, depth)
                
                tt_flag = TranspositionTableEntry.LOWER
                break
        
        # 存入置换表
        new_tt_entry = TranspositionTableEntry(
            hash_key=board_hash,
            depth=depth,
            score=best_score,
            flag=tt_flag,
            best_move=best_move
        )
        self.transposition_table[board_hash % self.tt_size] = new_tt_entry
        
        return best_score
    
    def _quiescence_search(self, board: Board, alpha: float, beta: float,
                           start_time: float, time_limit: float) -> float:
        """
        静态搜索（Quiescence Search）
        在叶子节点只搜索吃子和将军等"不稳定"的走法，
        避免水平线效应（Horizon Effect）
        """
        # 先获取静态评估值
        stand_pat = self.evaluator.evaluate(board)
        
        if stand_pat >= beta:
            return beta  # Beta剪枝
        
        if stand_pat > alpha:
            alpha = stand_pat
        
        # 只搜索吃子走法
        color = board.current_turn
        all_moves = board.get_legal_moves(color)
        
        # 过滤出吃子走法
        capture_moves = [m for m in all_moves if m.captured]
        
        # 按MVV-LVA排序（最有价值的目标优先）
        capture_moves.sort(key=lambda m: self.piece_values.get(m.captured, 0), reverse=True)
        
        for move in capture_moves[:10]:  # 限制静态搜索深度
            if time.time() - start_time > time_limit:
                break
            
            board.make_move(move)
            score = -self._quiescence_search(board, -beta, -alpha, start_time, time_limit)
            board.undo_move()
            
            if score >= beta:
                return beta
            
            if score > alpha:
                alpha = score
        
        return alpha
    
    def _get_tt_move(self, board: Board) -> Optional[Move]:
        """从置换表获取最佳走法建议"""
        board_hash = self.compute_hash(board)
        entry = self.transposition_table.get(board_hash % self.tt_size)
        
        if entry and entry.hash_key == board_hash and entry.best_move:
            return entry.best_move
        
        return None
    
    @property
    def piece_values(self):
        """便捷属性：访问棋子价值"""
        return self.evaluator.piece_values
