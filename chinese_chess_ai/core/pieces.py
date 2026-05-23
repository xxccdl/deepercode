# -*- coding: utf-8 -*-
"""
中国象棋 - 棋子定义与移动规则

实现所有7种棋子的移动规则和合法性检查
"""
from typing import List, Tuple, Optional
from dataclasses import dataclass
import numpy as np


@dataclass
class Move:
    """走法数据结构"""
    from_pos: Tuple[int, int]  # 起始位置 (row, col)
    to_pos: Tuple[int, int]    # 目标位置 (row, col)
    captured: Optional[str] = None  # 被吃的棋子（如果有）
    
    def __str__(self):
        cols = 'abcdefghi'
        from_col = cols[self.from_pos[1]]
        to_col = cols[self.to_pos[1]]
        return f"{from_col}{10-self.from_pos[0]}->{to_col}{10-self.to_pos[0]}"


class Piece:
    """棋子基类"""
    
    PIECE_TYPES = ['KING', 'ADVISOR', 'ELEPHANT', 'HORSE', 'CHARIOT', 'CANNON', 'PAWN']
    
    def __init__(self, piece_type: str, color: str, position: Tuple[int, int]):
        self.piece_type = piece_type
        self.color = color  # 'red' 或 'black'
        self.position = position
        self.alive = True
    
    def __repr__(self):
        color_char = 'R' if self.color == 'red' else 'B'
        type_chars = {
            'KING': 'K', 'ADVISOR': 'A', 'ELEPHANT': 'E',
            'HORSE': 'H', 'CHARIOT': 'C', 'CANNON': 'N', 'PAWN': 'P'
        }
        return f"{color_char}{type_chars.get(self.piece_type, '?')}"
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        """获取所有可能的走法（由子类实现）"""
        raise NotImplementedError


class King(Piece):
    """将/帅"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('KING', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 将/帅只能在九宫格内移动
        if self.color == 'red':
            palace_rows = range(7, 10)  # 红方九宫格（下方）
        else:
            palace_rows = range(0, 3)   # 黑方九宫格（上方）
        
        palace_cols = range(3, 6)       # 九宫格列范围
        
        # 上下左右四个方向
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            
            # 检查是否在九宫格内
            if new_row in palace_rows and new_col in palace_cols:
                target_piece = board.get_piece_at(new_row, new_col)
                
                # 目标位置为空或敌方棋子
                if target_piece is None or target_piece.color != self.color:
                    captured = target_piece.piece_type if target_piece else None
                    moves.append(Move(self.position, (new_row, new_col), captured))
        
        # 将帅对面（飞将）
        enemy_king_pos = board.find_king('black' if self.color == 'red' else 'red')
        if enemy_king_pos:
            if col == enemy_king_pos[1]:  # 同一列
                # 检查中间是否有棋子
                blocked = False
                min_row, max_row = min(row, enemy_king_pos[0]), max(row, enemy_king_pos[0])
                for r in range(min_row + 1, max_row):
                    if board.get_piece_at(r, col) is not None:
                        blocked = True
                        break
                
                if not blocked:
                    moves.append(Move(self.position, enemy_king_pos, 'KING'))
        
        return moves


class Advisor(Piece):
    """士/仕"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('ADVISOR', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 九宫格范围
        if self.color == 'red':
            palace_rows = range(7, 10)
        else:
            palace_rows = range(0, 3)
        palace_cols = range(3, 6)
        
        # 斜着走（四个对角方向）
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            
            if new_row in palace_rows and new_col in palace_cols:
                target_piece = board.get_piece_at(new_row, new_col)
                
                if target_piece is None or target_piece.color != self.color:
                    captured = target_piece.piece_type if target_piece else None
                    moves.append(Move(self.position, (new_row, new_col), captured))
        
        return moves


class Elephant(Piece):
    """象/相"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('ELEPHANT', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 象不能过河
        if self.color == 'red':
            valid_rows = range(5, 10)  # 红方半场
        else:
            valid_rows = range(0, 5)   # 黑方半场
        
        # 田字格移动（四个斜方向，步长2）
        directions = [(-2, -2), (-2, 2), (2, -2), (2, 2)]
        blocking_positions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]  # 象眼位置
        
        for i, (dr, dc) in enumerate(directions):
            new_row, new_col = row + dr, col + dc
            block_row, block_col = row + blocking_positions[i][0], col + blocking_positions[i][1]
            
            # 检查目标位置是否在己方半场
            if new_row in valid_rows and 0 <= new_col < 9:
                # 检查象眼是否被堵
                blocking_piece = board.get_piece_at(block_row, block_col)
                
                if blocking_piece is None:  # 象眼未被堵
                    target_piece = board.get_piece_at(new_row, new_col)
                    
                    if target_piece is None or target_piece.color != self.color:
                        captured = target_piece.piece_type if target_piece else None
                        moves.append(Move(self.position, (new_row, new_col), captured))
        
        return moves


class Horse(Piece):
    """马"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('HORSE', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 马走日字（8个可能的位置）
        # 先直后斜的移动方式
        move_patterns = [
            (-2, -1, -1, 0),  # 上左
            (-2, 1, -1, 0),   # 上右
            (2, -1, 1, 0),    # 下左
            (2, 1, 1, 0),     # 下右
            (-1, -2, 0, -1),  # 左上
            (-1, 2, 0, -1),   # 左下
            (1, -2, 0, 1),    # 右上
            (1, 2, 0, 1),     # 右下
        ]
        
        for dr, dc, leg_r, leg_c in move_patterns:
            new_row, new_col = row + dr, col + dc
            leg_row, leg_col = row + leg_r, col + leg_c
            
            # 检查是否在棋盘范围内
            if 0 <= new_row < 10 and 0 <= new_col < 9:
                # 检查蹩马腿
                blocking_piece = board.get_piece_at(leg_row, leg_col)
                
                if blocking_piece is None:  # 马腿未被堵
                    target_piece = board.get_piece_at(new_row, new_col)
                    
                    if target_piece is None or target_piece.color != self.color:
                        captured = target_piece.piece_type if target_piece else None
                        moves.append(Move(self.position, (new_row, new_col), captured))
        
        return moves


class Chariot(Piece):
    """车"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('CHARIOT', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 车可以直线移动（上下左右四个方向）
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        
        for dr, dc in directions:
            # 沿着一个方向一直走，直到遇到边界或棋子
            step = 1
            while True:
                new_row, new_col = row + dr * step, col + dc * step
                
                # 检查边界
                if not (0 <= new_row < 10 and 0 <= new_col < 9):
                    break
                
                target_piece = board.get_piece_at(new_row, new_col)
                
                if target_piece is None:
                    # 空位，可以移动
                    moves.append(Move(self.position, (new_row, new_col)))
                elif target_piece.color != self.color:
                    # 敌方棋子，可以吃掉，但不能继续移动
                    moves.append(Move(self.position, (new_row, new_col), target_piece.piece_type))
                    break
                else:
                    # 己方棋子，不能移动也不能继续
                    break
                
                step += 1
        
        return moves


class Cannon(Piece):
    """炮"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('CANNON', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        # 炮的移动规则：直线移动，吃子需要翻山（隔一个棋子）
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        
        for dr, dc in directions:
            step = 1
            found_platform = False  # 是否找到炮架（翻山的平台）
            
            while True:
                new_row, new_col = row + dr * step, col + dc * step
                
                # 检查边界
                if not (0 <= new_row < 10 and 0 <= new_col < 9):
                    break
                
                target_piece = board.get_piece_at(new_row, new_col)
                
                if not found_platform:
                    # 还没找到炮架
                    if target_piece is None:
                        # 空位，可以移动
                        moves.append(Move(self.position, (new_row, new_col)))
                    else:
                        # 找到炮架
                        found_platform = True
                else:
                    # 已经找到炮架，寻找目标
                    if target_piece is not None:
                        if target_piece.color != self.color:
                            # 可以吃掉敌方棋子
                            moves.append(Move(self.position, (new_row, new_col), target_piece.piece_type))
                        # 无论敌我，遇到棋子就停止
                        break
                
                step += 1
        
        return moves


class Pawn(Piece):
    """兵/卒"""
    
    def __init__(self, color: str, position: Tuple[int, int]):
        super().__init__('PAWN', color, position)
    
    def get_possible_moves(self, board: 'Board') -> List[Move]:
        moves = []
        row, col = self.position
        
        if self.color == 'red':
            # 红兵向上走（row减小）
            forward = -1
            crossed_river = row < 5  # 已过河（进入上半场）
        else:
            # 黑卒向下走（row增大）
            forward = 1
            crossed_river = row > 5  # 已过河（进入下半场）
        
        # 向前走一步
        new_row = row + forward
        if 0 <= new_row < 10:
            target_piece = board.get_piece_at(new_row, col)
            if target_piece is None or target_piece.color != self.color:
                captured = target_piece.piece_type if target_piece else None
                moves.append(Move(self.position, (new_row, col), captured))
        
        # 过河后可以左右移动
        if crossed_river:
            for dc in [-1, 1]:
                new_col = col + dc
                if 0 <= new_col < 9:
                    target_piece = board.get_piece_at(row, new_col)
                    if target_piece is None or target_piece.color != self.color:
                        captured = target_piece.piece_type if target_piece else None
                        moves.append(Move(self.position, (row, new_col), captured))
        
        return moves


# 棋子工厂函数
def create_piece(piece_type: str, color: str, position: Tuple[int, int]) -> Piece:
    """根据类型创建棋子实例"""
    piece_classes = {
        'KING': King,
        'ADVISOR': Advisor,
        'ELEPHANT': Elephant,
        'HORSE': Horse,
        'CHARIOT': Chariot,
        'CANNON': Cannon,
        'PAWN': Pawn,
    }
    
    piece_class = piece_classes.get(piece_type)
    if piece_class:
        return piece_class(color, position)
    else:
        raise ValueError(f"未知的棋子类型: {piece_type}")
