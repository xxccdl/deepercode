# -*- coding: utf-8 -*-
"""
中国象棋AI - 测试脚本

测试所有核心功能是否正常工作
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_board_initialization():
    """测试棋盘初始化"""
    print("\n" + "="*60)
    print("📋 测试1: 棋盘初始化")
    print("="*60)
    
    from core.board import Board
    
    board = Board()
    
    # 检查棋盘尺寸
    assert board.rows == 10, "棋盘行数应为10"
    assert board.cols == 9, "棋盘列数应为9"
    
    # 检查初始棋子数量
    red_pieces = len(board.get_all_pieces('red'))
    black_pieces = len(board.get_all_pieces('black'))
    
    assert red_pieces == 16, f"红方应有16个棋子，实际有{red_pieces}个"
    assert black_pieces == 16, f"黑方应有16个棋子，实际有{black_pieces}个"
    
    # 检查初始回合
    assert board.current_turn == 'red', "红方应先行"
    
    # 打印棋盘
    print("\n✅ 初始棋盘：")
    print(board.display())
    
    print("✅ 测试1通过！棋盘初始化正常\n")
    return True


def test_piece_movement():
    """测试棋子移动规则"""
    print("="*60)
    print("📋 测试2: 棋子移动规则")
    print("="*60)
    
    from core.board import Board
    from core.pieces import Move
    
    board = Board()
    
    # 测试车的移动（应该能直线移动）
    chariot = board.get_piece_at(9, 0)  # 红车
    if chariot:
        moves = chariot.get_possible_moves(board)
        print(f"\n红车的可能走法数: {len(moves)}")
        assert len(moves) > 0, "车应该有可走的位置"
        
        if moves:
            print(f"   示例走法: {moves[0]}")
    
    # 测试马的移动（检查蹩马腿）
    horse = board.get_piece_at(9, 1)  # 红马
    if horse:
        moves = horse.get_possible_moves(board)
        print(f"\n红马的可能走法数: {len(moves)}")
        assert len(moves) >= 2, "马至少应该有2个可走位置"
    
    # 测试炮的移动
    cannon = board.get_piece_at(7, 1)  # 红炮
    if cannon:
        moves = cannon.get_possible_moves(board)
        print(f"\n红炮的可能走法数: {len(moves)}")
        assert len(moves) > 0, "炮应该有可走的位置"
    
    # 测试兵的移动（未过河只能向前）
    pawn = board.get_piece_at(6, 0)  # 红兵
    if pawn:
        moves = pawn.get_possible_moves(board)
        print(f"\n红兵的可能走法数: {len(moves)}")
        assert len(moves) == 1, "未过河的兵应该只有1个可走位置（向前）"
    
    print("✅ 测试2通过！棋子移动规则正常\n")
    return True


def test_legal_moves():
    """测试合法走法生成"""
    print("="*60)
    print("📋 测试3: 合法走法生成")
    print("="*60)
    
    from core.board import Board
    
    board = Board()
    
    # 获取红方的所有合法走法
    red_moves = board.get_legal_moves('red')
    print(f"\n红方初始合法走法数量: {len(red_moves)}")
    
    # 中国象棋开局通常有约40-50种合法走法
    assert len(red_moves) >= 30, f"红方应有至少30种合法走法，实际{len(red_moves)}种"
    
    # 打印前10个走法示例
    print("\n前10个合法走法示例:")
    for i, move in enumerate(red_moves[:10], 1):
        piece = board.get_piece_at(*move.from_pos)
        piece_name = piece.piece_type if piece else '?'
        capture_info = f" (吃{move.captured})" if move.captured else ""
        print(f"  {i:2d}. {piece_name}: {move}{capture_info}")
    
    print("✅ 测试3通过！合法走法生成正常\n")
    return True


def test_move_execution():
    """测试走法执行和撤销"""
    print("="*60)
    print("📋 测试4: 走法执行与撤销")
    print("="*60)
    
    from core.board import Board
    from core.pieces import Move
    
    board = Board()
    
    # 记录初始状态
    initial_red_count = len(board.get_all_pieces('red'))
    initial_turn = board.current_turn
    
    # 执行一步走法：红炮二平五（常见的开局走法）
    move = Move(from_pos=(7, 1), to_pos=(7, 4))
    
    success = board.make_move(move)
    assert success, "走法应成功执行"
    
    # 验证走法后的状态
    assert board.current_turn == 'black', "执行后应轮到黑方"
    assert board.get_piece_at(7, 4) is not None, "目标位置应有棋子"
    assert board.get_piece_at(7, 1) is None, "原位置应为空"
    
    print(f"\n✅ 走法执行成功: {move}")
    print(f"   当前回合: {'黑方' if board.current_turn == 'black' else '红方'}")
    
    # 撤销走法
    undo_success = board.undo_move()
    assert undo_success, "撤销应成功"
    
    # 验证恢复到初始状态
    assert board.current_turn == initial_turn, "撤销后应恢复原来的回合"
    assert len(board.get_all_pieces('red')) == initial_red_count, "棋子数量应恢复"
    assert board.get_piece_at(7, 1) is not None, "原位置应恢复棋子"
    assert board.get_piece_at(7, 4) is None, "目标位置应为空"
    
    print(f"✅ 走法撤销成功，状态已恢复")
    
    print("✅ 测试4通过！走法执行/撤销功能正常\n")
    return True


def test_evaluator():
    """测试评估函数"""
    print("="*60)
    print("📋 测试5: 局面评估函数")
    print("="*60)
    
    from core.board import Board
    from core.evaluator import Evaluator
    
    board = Board()
    evaluator = Evaluator()
    
    # 评估初始局面
    score = evaluator.evaluate(board)
    
    print(f"\n初始局面评估分数: {score:+.2f}")
    print(f"   （正数对当前走子方有利，负数不利）")
    
    # 初始局面应该是接近平衡的（双方棋子和位置对称）
    assert -100 < score < 100, f"初始局面分数应在-100到100之间，实际为{score}"
    
    # 显示各维度得分
    material = evaluator._evaluate_material(board)
    position = evaluator._evaluate_position(board)
    mobility = evaluator._evaluate_mobility(board)
    protection = evaluator._evaluate_protection_threats(board)
    center = evaluator._evaluate_center_control(board)
    
    print(f"\n详细评估维度:")
    print(f"  材料价值: {material:+.2f}")
    print(f"  位置价值: {position:+.2f}")
    print(f"  机动性:   {mobility:+.2f}")
    print(f"  保护威胁: {protection:+.2f}")
    print(f"  中心控制: {center:+.2f}")
    
    print("✅ 测试5通过！评估函数正常\n")
    return True


def test_ai_search():
    """测试AI搜索算法"""
    print("="*60)
    print("📋 测试6: AI搜索算法")
    print("="*60)
    
    from core.board import Board
    from search.alphabeta import ChessAI
    
    board = Board()
    
    # 使用较浅深度进行快速测试
    ai = ChessAI(max_depth=3)  # 3层搜索深度
    
    print(f"\n开始AI搜索（深度={ai.config['max_depth']}）...")
    start_time = time.time()
    
    result = ai.get_best_move(board)
    
    search_time = time.time() - start_time
    
    if result.best_move:
        print(f"\n✅ AI找到最佳走法!")
        print(f"   最佳走法: {result.best_move}")
        print(f"   评估分数: {result.score:+.2f}")
        print(f"   搜索节点: {result.nodes_searched:,}")
        print(f"   搜索时间: {search_time:.3f}秒")
        print(f"   剪枝次数: {ai.cutoffs_count:,}")
        
        assert result.nodes_searched > 0, "应搜索了节点"
        assert search_time < 30, f"搜索时间不应超过30秒，实际{search_time:.2f}秒"
        
        # 验证最佳走法的合法性
        legal_moves = board.get_legal_moves('red')
        is_legal = any(
            m.from_pos == result.best_move.from_pos and 
            m.to_pos == result.best_move.to_pos
            for m in legal_moves
        )
        assert is_legal, "AI选择的走法应是合法的"
        
    else:
        print("❌ AI未能找到合法走法")
        return False
    
    print("✅ 测试6通过！AI搜索算法正常\n")
    return True


def test_self_play():
    """测试自博弈功能"""
    print("="*60)
    print("📋 测试7: 自博弈（简化版）")
    print("="*60)
    
    from learning.trainer import SelfPlayTrainer
    
    trainer = SelfPlayTrainer()
    
    # 进行一局快速自博弈（限制步数以加快速度）
    print("\n进行一局自博弈测试...")
    
    result = trainer.play_self_game(max_moves=20, verbose=False)
    
    print(f"\n✅ 自博弈完成!")
    print(f"   获胜方: {result.winner}")
    print(f"   总步数: {result.total_moves}")
    print(f"   用时: {result.duration:.2f}秒")
    
    assert result.total_moves > 0, "应进行了走棋"
    assert result.winner in ['red', 'black', 'draw'], "获胜方应为有效值"
    
    print("✅ 测试7通过！自博弈功能正常\n")
    return True


def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*70)
    print("🧪 中国象棋AI - 全功能测试套件")
    print("="*70)
    
    tests = [
        ("棋盘初始化", test_board_initialization),
        ("棋子移动规则", test_piece_movement),
        ("合法走法生成", test_legal_moves),
        ("走法执行/撤销", test_move_execution),
        ("局面评估函数", test_evaluator),
        ("AI搜索算法", test_ai_search),
        ("自博弈功能", test_self_play),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed, None))
        except Exception as e:
            print(f"❌ 测试失败: {name}")
            print(f"   错误信息: {e}\n")
            import traceback
            traceback.print_exc()
            results.append((name, False, str(e)))
    
    # 打印总结
    print("\n" + "="*70)
    print("📊 测试结果总结")
    print("="*70)
    
    passed_count = sum(1 for _, p, _ in results if p)
    total_count = len(results)
    
    for name, passed, error in results:
        status = "✅ 通过" if passed else "❌ 失败"
        error_msg = f" ({error})" if error else ""
        print(f"  {status} | {name}{error_msg}")
    
    print("-"*70)
    print(f"总计: {passed_count}/{total_count} 通过")
    
    if passed_count == total_count:
        print("\n🎉 所有测试通过！系统运行正常！\n")
        return True
    else:
        print(f"\n⚠️  有 {total_count - passed_count} 个测试失败，请检查错误信息。\n")
        return False


if __name__ == '__main__':
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
