// src/utils/dateUtils.ts

export const formatDate = (date: Date): string => {
	const options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	};
	return date.toLocaleDateString('zh-CN', options);
};

export const formatTime = (date: Date): string => {
	const options: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit',
	};
	return date.toLocaleTimeString('zh-CN', options);
};

export const formatDateTime = (date: Date): string => {
	return `${formatDate(date)} ${formatTime(date)}`;
};

export const getDurationInMinutes = (start: Date, end: Date): number => {
	return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
};

export const formatDuration = (minutes: number): string => {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours > 0 && mins > 0) {
		return `${hours}小时${mins}分钟`;
	} else if (hours > 0) {
		return `${hours}小时`;
	} else {
		return `${mins}分钟`;
	}
};

export const isToday = (date: Date): boolean => {
	const today = new Date();
	return (
		date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
};

export const isTomorrow = (date: Date): boolean => {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	return (
		date.getDate() === tomorrow.getDate() &&
		date.getMonth() === tomorrow.getMonth() &&
		date.getFullYear() === tomorrow.getFullYear()
	);
};

export const getRelativeDateLabel = (date: Date): string => {
	if (isToday(date)) return '今天';
	if (isTomorrow(date)) return '明天';
	return formatDate(date);
};

export const parseTimeString = (timeStr: string): Date | null => {
	const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;

	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);

	const date = new Date();
	date.setHours(hours, minutes, 0, 0);

	return date;
};

// ============================================================
// 艾宾浩斯调度器所需的日期辅助函数
// 全部基于原生 Date，零外部依赖
// ============================================================

/**
 * 将 Date 转换为 ISO 日期字符串 "YYYY-MM-DD"。
 * 使用本地时区而非 UTC，确保日期与用户所在时区一致。
 */
export const toISODate = (date: Date): string => {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
};

/**
 * 将 "YYYY-MM-DD" 格式字符串解析为本地时区的 Date 对象。
 */
export const parseISODate = (dateStr: string): Date => {
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d);
};

/**
 * 在指定日期上增加 days 天（可为负数表示减天），返回新的 Date 副本。
 */
export const addDays = (date: Date, days: number): Date => {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
};

/**
 * 计算两个日期之间相差的天数（忽略时分秒，仅比较日期部分）。
 * 返回整数，正数表示 b 晚于 a。
 */
export const daysBetween = (a: Date, b: Date): number => {
	const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
	const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
	return Math.round((bStart.getTime() - aStart.getTime()) / 86400000);
};

/**
 * 获取今天的 ISO 日期字符串 "YYYY-MM-DD"。
 */
export const todayISO = (): string => toISODate(new Date());
