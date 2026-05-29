// src/utils/scheduler.ts
//
// 艾宾浩斯间隔复习调度引擎
// 基于 SM-2 (SuperMemo 2) 算法 + 艾宾浩斯遗忘曲线理论，
// 100% 纯 TypeScript 实现，零外部依赖，可直接在任何 JS 运行时中测试。

import type {
  SpacedTask,
  UserFeedback,
  ReviewRecord,
  DifficultyLevel,
  TaskType,
} from '../types/task';
import { toISODate, parseISODate, addDays, todayISO } from './dateUtils';

// ============================================================
// 1. 反馈 → 质量评分映射
// ============================================================

/**
 * 将用户反馈映射为 SM-2 算法的质量评分 (0-5)。
 *
 * 评分含义（源自 SM-2 规范）：
 *   5 — 完美回忆，无需任何停顿
 *   4 — 正确回忆，但稍有犹豫
 *   3 — 正确回忆，但非常困难
 *   2 — 错误回忆，但看到正确答案后觉得"似曾相识"
 *   1 — 完全遗忘，看到正确答案也无印象
 *   0 — 完全空白，连题目都没印象
 *
 * 为降低用户操作负担，我们只提供三个中文选项：
 *   '秒懂'     → quality 5（完美，间隔翻倍增长）
 *   '模糊'     → quality 3（勉强正确，间隔温和增长）
 *   '完全忘了' → quality 1（遗忘，间隔重置回起点）
 */
const FEEDBACK_TO_QUALITY: Record<UserFeedback, number> = {
  '秒懂': 5,
  '模糊': 3,
  '完全忘了': 1,
};

// ============================================================
// 2. 初始易度因子计算
// ============================================================

/**
 * 根据用户自评的难度等级计算初始 EF（易度因子）。
 *
 * 设计思路：
 *   难度越高的知识点，遗忘速度越快，
 *   因此初始 EF 更低 → 间隔增长更慢 → 复习更频繁。
 *
 *   基准 EF = 2.5（SM-2 标准初始值）
 *   难度 1（很简单）→ EF = 2.8  复习间隔增长快
 *   难度 2          → EF = 2.65
 *   难度 3（中等）  → EF = 2.5   基准
 *   难度 4          → EF = 2.35
 *   难度 5（非常难）→ EF = 2.2   复习间隔增长慢
 */
export const calculateInitialEF = (difficulty: DifficultyLevel): number => {
  // 每偏离基准 1 级，EF 调整 0.15
  const offset = (3 - difficulty) * 0.15;
  return roundEF(2.5 + offset);
};

// ============================================================
// 3. EF 更新公式（SM-2 标准公式）
// ============================================================

/**
 * SM-2 易度因子更新公式。
 *
 * EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
 *
 * 直观理解：
 *   q = 5（完美）：EF 增加 0.1     → 下次间隔更长
 *   q = 4        ：EF 不变          → 间隔增长不变
 *   q = 3        ：EF 减少 ~0.14   → 下次间隔更短
 *   q < 3        ：EF 不变          → 回到 n=0，间隔重置
 *
 * EF 下限为 1.3 —— SM-2 规范：低于 1.3 的 EF 没有实际意义，
 * 因为间隔会增长过慢，导致用户永远在复习同一个知识点。
 */
const updateEF = (currentEF: number, quality: number): number => {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return roundEF(currentEF + delta);
};

/** 保留两位小数，避免浮点精度扩散 */
const roundEF = (ef: number): number => {
  const rounded = Math.round(ef * 100) / 100;
  return Math.max(rounded, 1.3);
};

// ============================================================
// 4. 复习间隔计算
// ============================================================

/**
 * 根据当前重复次数和 EF 计算下次复习间隔（天）。
 *
 * SM-2 间隔规则：
 *   n = 0（从未成功回忆）→ 1 天（明天就复习）
 *   n = 1（第一次成功） → 6 天（约一周后）
 *   n ≥ 2               → round(Iₙ₋₁ × EF)（上一轮间隔 × EF）
 *
 * 前两个固定间隔对应艾宾浩斯曲线中的两个关键节点：
 *   - 第 1 天：记忆留存 ~33%，必须趁热打铁
 *   - 第 6 天：记忆留存 ~25%，需要第二次强化
 *   此后记忆已相对稳定，按 EF 动态推算即可
 */
const calculateInterval = (
  repetitions: number,
  previousInterval: number,
  ef: number
): number => {
  if (repetitions === 0) return 1;    // 首轮：1 天后复习
  if (repetitions === 1) return 6;    // 次轮：6 天后复习
  return Math.round(previousInterval * ef); // 后续：指数增长
};

// ============================================================
// 5. 核心调度函数（对外唯一入口）
// ============================================================

/**
 * 根据用户的回忆反馈，推算并返回更新后的 SpacedTask。
 *
 * 这是一个纯函数：不修改传入的 task，而是返回一份全新的对象副本。
 * 调用方负责将返回的 task 持久化到 store / localStorage / 后端。
 *
 * @param task   - 当前的间隔复习任务
 * @param feedback - 用户反馈：'秒懂' | '模糊' | '完全忘了'
 * @returns 更新后的 SpacedTask（全新对象）
 *
 * --- 算法流程 ---
 *
 *   用户反馈 "秒懂" / "模糊" / "完全忘了"
 *          │
 *          ▼
 *   feedback → quality (SM-2 评分)
 *          │
 *          ├── quality ≥ 3（回忆成功）
 *          │     ├── repetitions++（成功计数 +1）
 *          │     ├── consecutiveCorrect++（连续正确 +1）
 *          │     ├── EF 按 SM-2 公式更新
 *          │     └── interval = calcInterval(repetitions, prevInterval, EF)
 *          │
 *          └── quality < 3（回忆失败）
 *                ├── repetitions = 0（重置回起点）
 *                ├── consecutiveCorrect = 0
 *                ├── EF 不变（不惩罚 EF，只重置间隔）
 *                └── interval = 1（明天重新来过）
 *          │
 *          ▼
 *   nextReviewDate = today + interval 天
 *          │
 *          ▼
 *   返回更新后的 SpacedTask
 */
export const calculateNextReview = (
  task: SpacedTask,
  feedback: UserFeedback
): SpacedTask => {
  const quality = FEEDBACK_TO_QUALITY[feedback];
  const today = todayISO();

  // ---- 提起当前状态 ----
  let { repetitions, easeFactor, interval: prevInterval, consecutiveCorrect } = task;

  let newInterval: number;
  let newRepetitions: number;
  let newConsecutiveCorrect: number;
  let newEF: number;

  if (quality >= 3) {
    // ✅ 回忆成功：推进复习进度
    newRepetitions = repetitions + 1;
    newConsecutiveCorrect = consecutiveCorrect + 1;
    newEF = updateEF(easeFactor, quality);
    // SM-2 使用旧 repetitions 决定间隔档位（0→1天, 1→6天, ≥2→指数增长）
    newInterval = calculateInterval(repetitions, prevInterval, newEF);
  } else {
    // ❌ 回忆失败：重置回起点，但保留 EF（不过度惩罚）
    newRepetitions = 0;
    newConsecutiveCorrect = 0;
    newEF = easeFactor;
    newInterval = 1; // 明天重新来
  }

  // ---- 计算下次复习日期 ----
  const nextDate = addDays(parseISODate(today), newInterval);
  const nextReviewDate = toISODate(nextDate);

  // ---- 构建复习记录 ----
  const reviewRecord: ReviewRecord = {
    date: today,
    feedback,
    quality,
    interval: prevInterval,
    easeFactor,
  };

  // ---- 返回全新的 SpacedTask 对象（纯函数，不修改入参）----
  return {
    ...task,
    lastReviewDate: today,
    nextReviewDate,
    repetitions: newRepetitions,
    easeFactor: newEF,
    interval: newInterval,
    consecutiveCorrect: newConsecutiveCorrect,
    reviewHistory: [...task.reviewHistory, reviewRecord],
  };
};

// ============================================================
// 6. 工厂函数：创建一个全新的 SpacedTask
// ============================================================

/**
 * 创建一个新的间隔复习任务。
 *
 * @param title      - 任务名称，如 "线性表核心考点"
 * @param taskType   - 'learn'（初学）或 'review'（复习）
 * @param difficulty - 用户自评掌握难度 1-5
 * @param id         - 可选，默认用当前时间戳 + 随机数生成唯一 ID
 * @returns 初始化的 SpacedTask，nextReviewDate = 今天（立即需要复习）
 */
export const createSpacedTask = (
  title: string,
  taskType: TaskType,
  difficulty: DifficultyLevel,
  id?: string
): SpacedTask => {
  const now = new Date();
  const today = toISODate(now);
  const initialEF = calculateInitialEF(difficulty);

  return {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    taskType,
    difficulty,
    lastReviewDate: null,
    nextReviewDate: today,          // 今天就需要学习/复习
    createdAt: today,
    repetitions: 0,                 // 尚未成功回忆过
    easeFactor: initialEF,
    interval: 0,                    // 还没有间隔
    consecutiveCorrect: 0,
    reviewHistory: [],
  };
};
