# -*- coding: utf-8 -*-
"""
中国象棋AI - 配置参数
"""

# 搜索配置
SEARCH_CONFIG = {
    'max_depth': 4,              # 最大搜索深度（默认4层，平衡速度与智能）
    'iterative_deepening': True,  # 启用迭代加深
    'use_transposition_table': True,  # 使用置换表
    'use_killer_moves': True,     # 使用杀手步法
    'use_history_heuristic': True,  # 使用历史启发
    'null_move_pruning': True,    # 空步裁剪
    'null_move_reduction': 2,     # 空步减少深度
    'aspiration_window': 50,      # 渴望窗口大小
    'time_limit': 3.0,            # 时间限制（秒）
}

# 评估函数配置
EVALUATOR_CONFIG = {
    # 棋子基础价值（分）
    'piece_values': {
        'KING': 10000,        # 将/帅
        'ADVISOR': 200,       # 士/仕
        'ELEPHANT': 200,      # 象/相
        'HORSE': 400,         # 马
        'CHARIOT': 900,       # 车
        'CANNON': 450,        # 炮
        'PAWN': 100,          # 兵/卒
    },
    
    # 位置价值表权重
    'position_weight': 0.6,
    
    # 机动性权重
    'mobility_weight': 0.15,
    
    # 保护与威胁权重
    'protection_weight': 0.1,
    
    # 中心控制权重
    'center_control_weight': 0.15,
}

# 训练配置
TRAINING_CONFIG = {
    'learning_rate': 0.01,
    'epochs': 100,
    'games_per_epoch': 10,
    'experience_replay_size': 10000,
    'batch_size': 32,
    'exploration_rate': 0.3,      # 初始探索率
    'exploration_decay': 0.995,   # 探索率衰减
    'min_exploration_rate': 0.05, # 最小探索率
    'discount_factor': 0.95,      # 折扣因子
}

# 棋盘配置
BOARD_CONFIG = {
    'rows': 10,
    'cols': 9,
    'red_side': 'bottom',        # 红方在下方
}
