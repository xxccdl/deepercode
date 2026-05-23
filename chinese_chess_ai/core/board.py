# -*- coding: utf-8 -*-
"""
中国象棋 - 棋盘状态管理

管理棋盘状态、走法执行/撤销、合法性检查
"""
from typing import List, Dict, Optional, Tuple
import copy
import numpy as np
from .pieces import Piece, Move, create_piece


class Board:
    """中国象棋棋盘"""
    
    def __init__(self):
        self.rows = 10
        self.cols = 9
        self.grid: List[List[Optional[Piece]]] = [[None] * self.cols for _ in range(self.rows)]
        self.pieces: Dict[str, Piece] = {}  # 所有存活的棋子
        self.current_turn = 'red'  # 当前走子方（红方先行）
        self.move_history: List[Tuple[Move, Optional[Piece]]] = []  # 走法历史（用于撤销）
        self.position_hash = 0  # 位置哈希值（用于置换表）
        
        self._setup_initial_position()
    
    def _setup_initial_position(self):
        """设置初始布局"""
        # 黑方（上方，row 0-4）
        black_pieces = [
            ('CHARIOT', (0, 0)), ('HORSE', (0, 1)), ('ELEPHANT', (0, 2)),
            ('ADVISOR', (0, 3)), ('KING', (0, 4)), ('ADVISOR', (0, 5)),
            ('ELEPHANT', (0, 6)), ('HORSE', (0, 7)), ('CHARIOT', (0, 8)),
            ('CANNON', (2, 1)), ('CANNON', (2, 7)),
            ('PAWN', (3, 0)), ('PAWN', (3, 2)), ('PAWN', (3, 4)),
            ('PAWN', (3, 6)), ('PAWN', (3, 8)),
        ]
        
        # 红方（下方，row 5-9）
        red_pieces = [
            ('CHARIOT', (9, 0)), ('HORSE', (9, 1)), ('ELEPHANT', (9, 2)),
            ('ADVISOR', (9, 3)), ('KING', (9, 4)), ('ADVISOR', (9, 5)),
            ('ELEPHANT', (9, 6)), ('HORSE', (9, 7)), ('CHARIOT', (9, 8)),
            ('CANNON', (7, 1)), ('CANNON', (7, 7)),
            ('PAWN', (6, 0)), ('PAWN', (6, 2)), ('PAWN', (6, 4)),
            ('PAWN', (6, 6)), ('PAWN', (6, 8)),
        ]
        
        # 放置黑方棋子
        for piece_type, pos in black_pieces:
            piece = create_piece(piece_type, 'black', pos)
            self.grid[pos[0]][pos[1]] = piece
            self.pieces[f"black_{piece_type}_{pos[0]}_{pos[1]}"] = piece
        
        # 放置红方棋子
        for piece_type, pos in red_pieces:
            piece = create_piece(piece_type, 'red', pos)
            self.grid[pos[0]][pos[1]] = piece
            self.pieces[f"red_{piece_type}_{pos[0]}_{pos[1]}"] = piece
        
        self._update_position_hash()
    
    def get_piece_at(self, row: int, col: int) -> Optional[Piece]:
        """获取指定位置的棋子"""
        if 0 <= row < self.rows and 0 <= col < self.cols:
            return self.grid[row][col]
        return None
    
    def find_king(self, color: str) -> Optional[Tuple[int, int]]:
        """查找指定颜色的将/帅位置"""
        for key, piece in self.pieces.items():
            if piece.piece_type == 'KING' and piece.color == color and piece.alive:
                return piece.position
        return None
    
    def make_move(self, move: Move) -> bool:
        """
        执行一步走法
        返回：是否成功执行
        """
        from_row, from_col = move.from_pos
        to_row, to_col = move.to_pos
        
        # 获取移动的棋子
        moving_piece = self.get_piece_at(from_row, from_col)
        if not moving_piece or moving_piece.color != self.current_turn:
            return False
        
        # 获取目标位置的棋子（可能被吃）
        captured_piece = self.get_piece_at(to_row, to_col)
        
        # 记录历史（用于撤销）
        self.move_history.append((move, captured_piece))
        
        # 如果吃子，标记被吃的棋子为死亡
        if captured_piece:
            captured_piece.alive = False
            # 使用位置信息作为key来删除（与初始化时一致）
            cap_row, cap_col = captured_piece.position
            cap_key = f"{captured_piece.color}_{captured_piece.piece_type}_{cap_row}_{cap_col}"
            if cap_key in self.pieces:
                del self.pieces[cap_key]
        
        # 移动棋子
        self.grid[from_row][from_col] = None
        self.grid[to_row][to_col] = moving_piece
        moving_piece.position = (to_row, to_col)
        
        # 更新pieces字典的key
        old_key = f"{moving_piece.color}_{moving_piece.piece_type}_{from_row}_{from_col}"
        new_key = f"{moving_piece.color}_{moving_piece.piece_type}_{to_row}_{to_col}"
        if old_key in self.pieces:
            del self.pieces[old_key]
        self.pieces[new_key] = moving_piece
        
        # 切换回合
        self.current_turn = 'black' if self.current_turn == 'red' else 'red'
        
        # 更新位置哈希
        self._update_position_hash()
        
        return True
    
    def undo_move(self):
        """撤销上一步走法"""
        if not self.move_history:
            return False
        
        move, captured_piece = self.move_history.pop()
        from_row, from_col = move.from_pos
        to_row, to_col = move.to_pos
        
        # 获取移动的棋子
        moving_piece = self.get_piece_at(to_row, to_col)
        
        # 恢复棋子位置
        self.grid[to_row][to_col] = captured_piece if captured_piece else None
        self.grid[from_row][from_col] = moving_piece
        moving_piece.position = (from_row, from_col)
        
        # 恢复被吃的棋子
        if captured_piece:
            captured_piece.alive = True
            # 使用位置信息作为key（与初始化和make_move一致）
            cap_row, cap_col = captured_piece.position
            cap_key = f"{captured_piece.color}_{captured_piece.piece_type}_{cap_row}_{cap_col}"
            self.pieces[cap_key] = captured_piece
        
        # 更新pieces字典
        new_key = f"{moving_piece.color}_{moving_piece.piece_type}_{to_row}_{to_col}"
        old_key = f"{moving_piece.color}_{moving_piece.piece_type}_{from_row}_{from_col}"
        if new_key in self.pieces:
            del self.pieces[new_key]
        self.pieces[old_key] = moving_piece
        
        # 切换回上一方的回合
        self.current_turn = 'black' if self.current_turn == 'red' else 'red'
        
        # 更新位置哈希
        self._update_position_hash()
        
        return True
    
    def get_all_pieces(self, color: str) -> List[Piece]:
        """获取指定颜色的所有存活棋子"""
        return [p for p in self.pieces.values() if p.color == color and p.alive]
    
    def is_in_check(self, color: str) -> bool:
        """
        检查指定颜色是否被将军
        """
        king_pos = self.find_king(color)
        if not king_pos:
            return True  # 将/帅被吃了（理论上不应该发生）
        
        enemy_color = 'black' if color == 'red' else 'red'
        enemy_pieces = self.get_all_pieces(enemy_color)
        
        for piece in enemy_pieces:
            moves = piece.get_possible_moves(self)
            for move in moves:
                if move.to_pos == king_pos:
                    return True
        
        return False
    
    def is_checkmate(self, color: str) -> bool:
        """
        检查是否被将死
        条件：被将军且无任何合法走法可以解除将军
        """
        if not self.is_in_check(color):
            return False
        
        return len(self.get_legal_moves(color)) == 0
    
    def get_legal_moves(self, color: str) -> List[Move]:
        """
        获取指定颜色的所有合法走法
        合法走法：不会导致自己被将军的走法
        """
        legal_moves = []
        pieces = self.get_all_pieces(color)
        
        for piece in pieces:
            pseudo_moves = piece.get_possible_moves(self)
            
            for move in pseudo_moves:
                # 尝试执行这步棋
                if self.make_move(move):
                    # 检查走完后自己是否还被将军
                    if not self.is_in_check(color):
                        legal_moves.append(move)
                    
                    # 撤销这步棋
                    self.undo_move()
        
        return legal_moves
    
    def _update_position_hash(self):
        """更新位置哈希值（用于置换表）"""
        hash_value = 0
        for piece in self.pieces.values():
            if piece.alive:
                row, col = piece.position
                # 简单的Zobrist哈希变种
                piece_code = hash(f"{piece.color}_{piece.piece_type}")
                position_code = row * self.cols + col
                hash_value ^= (piece_code * (position_code + 1))
        
        # 加入当前回合信息
        turn_code = hash(self.current_turn)
        hash_value ^= turn_code
        
        self.position_hash = hash_value
    
    def clone(self) -> 'Board':
        """创建棋盘的深拷贝（用于搜索）"""
        new_board = Board.__new__(Board)
        new_board.rows = self.rows
        new_board.cols = self.cols
        new_board.grid = [[None] * self.cols for _ in range(self.rows)]
        new_board.pieces = {}
        new_board.current_turn = self.current_turn
        new_board.move_history = []
        new_board.position_hash = self.position_hash
        
        # 深拷贝所有棋子
        for key, piece in self.pieces.items():
            if piece.alive:
                new_piece = create_piece(piece.piece_type, piece.color, piece.position)
                new_board.grid[piece.position[0]][piece.position[1]] = new_piece
                new_board.pieces[key] = new_piece
        
        return new_board
    
    def display(self) -> str:
        """返回棋盘的可视化字符串表示"""
        board_str = "\n   a b c d e f g h i\n"
        board_str += "  ---------------------\n"
        
        for row in range(self.rows):
            line = f"{10-row}|"  # 行号（从10到1）
            for col in range(self.cols):
                piece = self.grid[row][col]
                if piece:
                    # 使用Unicode象棋符号
                    symbols = {
                        ('red', 'KING'): '帥', ('black', 'KING'): '將',
                        ('red', 'ADVISOR'): '仕', ('black', 'ADVISOR'): '士',
                        ('red', 'ELEPHANT'): '相', ('black', 'ELEPHANT'): '象',
                        ('red', 'HORSE'): '馬', ('black', 'HORSE'): '馬',
                        ('red', 'CHARIOT'): '車', ('black', 'CHARIOT'): '車',
                        ('red', 'CANNON'): '炮', ('black', 'CANNON'): '砲',
                        ('red', 'PAWN'): '兵', ('black', 'PAWN'): '卒',
                    }
                    symbol = symbols.get((piece.color, piece.piece_type), '?')
                    line += f"{symbol} "
                else:
                    line += "· "
            
            line += f"|{10-row}\n"
            if row == 4:  # 在楚河汉界处添加分隔
                board_str += "  =====================\n"
        
        board_str += "  ---------------------\n"
        board_str += "   a b c d e f g h i\n"
        board_str += f"\n当前回合: {'红方' if self.current_turn == 'red' else '黑方'}\n"
        
        return board_str
    
    def __str__(self):
        return self.display()
