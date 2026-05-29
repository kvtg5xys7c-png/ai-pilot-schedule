// src/utils/__tests__/scheduler.test.ts
//
// 纯逻辑单元测试，不依赖任何框架。
// 运行方式：npx tsx src/utils/__tests__/scheduler.test.ts
// 或集成到 Jest 中。

import { createSpacedTask, calculateNextReview, calculateInitialEF } from '../scheduler';
import type { SpacedTask, DifficultyLevel } from '../../types/task';
import { toISODate, addDays, parseISODate } from '../dateUtils';

// ---- 简单的 assert 工具（零依赖）----
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ~${expected}, got ${actual}`);
  }
}

// ============================================================
// 测试用例
// ============================================================

console.log('\n=== 测试 1: 初始 EF 计算 ===\n');

assertClose(calculateInitialEF(3), 2.5, 0.01, '难度 3 → EF 2.5 (基准)');
assert(calculateInitialEF(1) > calculateInitialEF(3), '难度 1 EF > 难度 3 EF (简单题间隔更长)');
assert(calculateInitialEF(5) < calculateInitialEF(3), '难度 5 EF < 难度 3 EF (难题更频繁复习)');
assert(calculateInitialEF(1) >= 1.3, '所有 EF >= 1.3 下限');

console.log('\n=== 测试 2: createSpacedTask 工厂函数 ===\n');

const task = createSpacedTask('线性表核心考点', 'learn', 3);
assertEqual(task.title, '线性表核心考点', '标题正确');
assertEqual(task.taskType, 'learn', '类型正确');
assertEqual(task.repetitions, 0, '初始 repetitions = 0');
assertEqual(task.consecutiveCorrect, 0, '初始 consecutiveCorrect = 0');
assertEqual(task.interval, 0, '初始 interval = 0');
assertEqual(task.lastReviewDate, null, '初始 lastReviewDate = null');
assertEqual(task.reviewHistory.length, 0, '初始无复习记录');
assertEqual(task.nextReviewDate, toISODate(new Date()), 'nextReviewDate = 今天');

console.log('\n=== 测试 3: "秒懂" → 首轮（n=0 → n=1）===\n');

const afterMain = calculateNextReview(task, '秒懂');

assertEqual(afterMain.repetitions, 1, 'repetitions 从 0 → 1');
assertEqual(afterMain.consecutiveCorrect, 1, 'consecutiveCorrect 从 0 → 1');
assertEqual(afterMain.interval, 1, 'n=0 首轮间隔 = 1 天');
assert(afterMain.easeFactor >= 2.5, '秒懂后 EF 应增加（>= 2.5）');
assertEqual(afterMain.reviewHistory.length, 1, '复习历史追加一条');
assertEqual(afterMain.lastReviewDate, toISODate(new Date()), 'lastReviewDate 更新为今天');

// 验证 nextReviewDate = 今天 + 1
const expectedNext1 = toISODate(addDays(new Date(), 1));
assertEqual(afterMain.nextReviewDate, expectedNext1, '首轮秒懂 → 明天复习');

console.log('\n=== 测试 4: "秒懂" → 次轮（n=1 → n=2）===\n');

const afterSecondMain = calculateNextReview(afterMain, '秒懂');

assertEqual(afterSecondMain.repetitions, 2, 'repetitions 从 1 → 2');
assertEqual(afterSecondMain.consecutiveCorrect, 2, '连续正确 = 2');
assertEqual(afterSecondMain.interval, 6, 'n=1 次轮间隔 = 6 天');

const expectedNext6 = toISODate(addDays(new Date(), 6));
assertEqual(afterSecondMain.nextReviewDate, expectedNext6, '次轮秒懂 → 6天后复习');

console.log('\n=== 测试 5: "秒懂" → 三轮（n≥2，指数增长）===\n');

const afterThirdMain = calculateNextReview(afterSecondMain, '秒懂');

assertEqual(afterThirdMain.repetitions, 3, 'repetitions 从 2 → 3');
// interval = round(6 * EF), EF ~ 2.6 → ~16 天
assert(afterThirdMain.interval >= 13 && afterThirdMain.interval <= 18, `三轮间隔应在 13~18 天，实际=${afterThirdMain.interval}`);

console.log('\n=== 测试 6: "模糊" → 间隔增长缓慢 ===\n');

const taskFuzzy = createSpacedTask('操作系统PV操作', 'review', 4);
const afterFuzzy1 = calculateNextReview(taskFuzzy, '模糊');
assertEqual(afterFuzzy1.interval, 1, '模糊: 首轮仍是 1 天');
assertEqual(afterFuzzy1.repetitions, 1, '模糊也算成功，repetitions +1');

const afterFuzzy2 = calculateNextReview(afterFuzzy1, '模糊');
assertEqual(afterFuzzy2.interval, 6, '模糊: 次轮仍是 6 天');
// EF 应该下降了（模糊 → quality 3 → EF 减少）
assert(afterFuzzy2.easeFactor < afterFuzzy1.easeFactor, '模糊导致 EF 下降');

console.log('\n=== 测试 7: "完全忘了" → 重置回起点 ===\n');

const taskForgotten = createSpacedTask('死锁检测算法', 'learn', 5);
// 先让它升到 n=2
const t1 = calculateNextReview(taskForgotten, '秒懂');
const t2 = calculateNextReview(t1, '秒懂');
// 然后用 "完全忘了" 重置
const t3 = calculateNextReview(t2, '完全忘了');

assertEqual(t3.repetitions, 0, '完全忘了 → repetitions 重置为 0');
assertEqual(t3.consecutiveCorrect, 0, '完全忘了 → 连续正确归零');
assertEqual(t3.interval, 1, '完全忘了 → 间隔重置为 1 天');
// EF 不变
assertEqual(t3.easeFactor, t2.easeFactor, '完全忘了 → EF 保持不变');

console.log('\n=== 测试 8: 连续遗忘 → 每次都回到 1 天 ===\n');

const taskStruggle = createSpacedTask('排序算法对比', 'review', 4);
const s1 = calculateNextReview(taskStruggle, '完全忘了');
assertEqual(s1.interval, 1, '第一次忘了 → 1 天');
const s2 = calculateNextReview(s1, '完全忘了');
assertEqual(s2.interval, 1, '第二次忘了 → 还是 1 天');
assertEqual(s2.repetitions, 0, '始终 reps = 0');
// 每次反馈都会追加历史
assertEqual(s2.reviewHistory.length, 2, '历史正确记录');

console.log('\n=== 测试 9: 纯函数性 —— 不修改原始对象 ===\n');

const original = createSpacedTask('测试纯函数', 'learn', 3);
const originalSnapshot = JSON.stringify(original);
calculateNextReview(original, '秒懂');
calculateNextReview(original, '模糊');
calculateNextReview(original, '完全忘了');
const afterMultiCalls = JSON.stringify(original);
assertEqual(afterMultiCalls, originalSnapshot, '多次调用后原始对象不变');

console.log('\n=== 测试 10: 混合场景（模拟真实复习轨迹）===\n');

// 模拟一个真实的知识点复习轨迹
const realTask = createSpacedTask('二叉树遍历', 'learn', 3);
// 第 1 天: 秒懂 → 明天复习
const r1 = calculateNextReview(realTask, '秒懂');
// 第 6 天: 模糊 → 间隔温和增长
const r2 = calculateNextReview(r1, '模糊');
// 某天后: 秒懂 → 更长间隔
const r3 = calculateNextReview(r2, '秒懂');
// 某天后: 完全忘了 → 重置
const r4 = calculateNextReview(r3, '完全忘了');

// 验证最终状态
assertEqual(r4.repetitions, 0, '最终 reps = 0');
assertEqual(r4.reviewHistory.length, 4, '共 4 条复习记录');
// 验证历史记录内容
assertEqual(r4.reviewHistory[0].feedback, '秒懂', '记录 1: 秒懂');
assertEqual(r4.reviewHistory[1].feedback, '模糊', '记录 2: 模糊');
assertEqual(r4.reviewHistory[2].feedback, '秒懂', '记录 3: 秒懂');
assertEqual(r4.reviewHistory[3].feedback, '完全忘了', '记录 4: 完全忘了');

// ============================================================
// 结果汇总
// ============================================================

console.log('\n========================================');
console.log(`  测试完成: ${passed} 通过, ${failed} 失败`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
