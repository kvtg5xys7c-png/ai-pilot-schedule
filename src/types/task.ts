// src/types/task.ts

export type TaskStatus = 'pending' | 'completed' | 'missed';

export interface Task {
	id: string;
	title: string;
	startTime: Date;
	endTime: Date;
	aiMessage: string;
	status: TaskStatus;
	notificationId?: string;
}

export interface TaskInput {
	userGoal: string;
	availableTime: string;
	startDate?: Date;
	endDate?: Date;
}

export interface AITaskResponse {
	tasks: Omit<Task, 'notificationId'>[];
	summary?: string;
}

export interface RescheduleRequest {
	missedTasks: Task[];
	remainingTasks: Task[];
	currentTime: Date;
	availableTimeSlots: string[];
}

// ============================================================
// 艾宾浩斯间隔复习系统 — 类型定义 (Ebbinghaus Spaced Repetition)
// ============================================================

/** 用户对当前知识点的回忆反馈 */
export type UserFeedback = '秒懂' | '模糊' | '完全忘了';

/** 任务类型：初学（首次接触）或复习（回顾已学内容） */
export type TaskType = 'learn' | 'review';

/** 用户对知识点的自评掌握难度，1 = 很简单，5 = 非常难 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * 单次复习记录
 * 每次用户反馈后被追加到 SpacedTask.reviewHistory 中，
 * 用于后续分析或可视化遗忘曲线。
 */
export interface ReviewRecord {
	/** 本次复习日期 (ISO 8601 日期字符串，如 "2026-05-14") */
	date: string;
	/** 用户反馈 */
	feedback: UserFeedback;
	/** SM-2 算法对应的质量评分 (0-5) */
	quality: number;
	/** 本次复习前的间隔天数 */
	interval: number;
	/** 本次复习前的易度因子 */
	easeFactor: number;
}

/**
 * 基于艾宾浩斯遗忘曲线的间隔复习任务模型。
 *
 * 字段命名尽量自解释；核心调度由 scheduler.ts 中的纯函数负责，
 * 该模型只承载数据，不包含任何调度逻辑。
 */
export interface SpacedTask {
	/** 唯一标识 */
	id: string;
	/** 任务名称，如 "线性表核心考点" */
	title: string;
	/** 初学 / 复习 */
	taskType: TaskType;
	/** 用户自评的掌握难度 (1-5) */
	difficulty: DifficultyLevel;
	/** 上次学习/复习日期，从未复习过则为 null */
	lastReviewDate: string | null;
	/** 系统推算的下次复习日期 (ISO 8601 日期字符串) */
	nextReviewDate: string;
	/** 任务创建日期 */
	createdAt: string;
	/** 成功回忆的累计次数（quality >= 3 时 +1） */
	repetitions: number;
	/** SM-2 易度因子，初始值由难度推导，后续根据反馈动态调整 */
	easeFactor: number;
	/** 当前复习间隔（天），即 lastReviewDate 到 nextReviewDate 的天数 */
	interval: number;
	/** 连续正确回忆次数（quality >= 3 的连续计数，一旦遗忘则归零） */
	consecutiveCorrect: number;
	/** 完整复习历史 */
	reviewHistory: ReviewRecord[];
}

/**
 * calculateNextReview 的返回值 ——
 * 一份全新的 SpacedTask 副本，包含根据反馈更新后的所有字段。
 */
export interface ScheduleResult {
	task: SpacedTask;
}

/**
 * 艾宾浩斯预设间隔（天），作为 SM-2 初始几轮的基础参考。
 *
 * 记忆留存关键节点（基于经典艾宾浩斯实验数据）：
 *   20 分钟后记忆留存 ~58%
 *    1 小时后记忆留存 ~44%
 *    1 天后记忆留存 ~33%
 *    6 天后记忆留存 ~25%
 *   31 天后记忆留存 ~21%
 *
 * 因此首轮间隔设为 1 天 → 6 天 → ... 后续由 SM-2 算法动态推算。
 */
export const EBBINGHAUS_INTERVALS: readonly number[] = [1, 6] as const;
