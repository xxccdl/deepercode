# Chinese Chess AI - 中国象棋智能体

基于 Alpha-Beta 搜索 + 自博弈学习的轻量级中国象棋 AI 引擎

## 特性
- ✅ 完整的中国象棋规则实现
- ✅ Alpha-Beta 剪枝搜索算法
- ✅ 高级优化：置换表、迭代加深、历史启发、杀手步法
- ✅ 自博弈强化学习系统（CPU友好）
- ✅ 轻量级设计，无需GPU
- ✅ 智能评估函数（棋子价值+位置价值+机动性）
- ✅ 命令行交互界面

## 安装依赖
```bash
pip install -r requirements.txt
```

## 使用方法

### 人机对战
```bash
python main.py --mode vs
```

### AI自训练
```bash
python main.py --mode train --epochs 100
```

### AI对弈（观看两AI对战）
```bash
python main.py --mode watch
```

## 项目结构
```
chinese_chess_ai/
├── core/                  # 核心引擎
│   ├── board.py          # 棋盘状态管理
│   ├── pieces.py         # 棋子定义与规则
│   ├── move_generator.py # 走法生成器
│   └── evaluator.py      # 局面评估器
├── search/                # 搜索算法
│   ├── alphabeta.py      # Alpha-Beta搜索
│   └── optimizations.py  # 搜索优化技术
├── learning/              # 学习系统
│   ├── trainer.py        # 自博弈训练器
│   └── experience.py     # 经验回放缓冲区
├── ui/                    # 用户界面
│   └── cli.py            # 命令行界面
├── utils/                 # 工具函数
│   └── helpers.py        # 辅助函数
├── main.py               # 主入口
└── config.py             # 配置参数
```

## 技术栈
- Python 3.8+
- 纯NumPy计算（无深度学习框架依赖）
- 经典游戏树搜索算法
- 轻量级强化学习
