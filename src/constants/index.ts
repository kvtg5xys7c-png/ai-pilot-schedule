// src/constants/index.ts

export const APP_CONFIG = {
name: 'AI Pilot Schedule',
version: '1.0.0',

// 默认提醒时间（分钟）
defaultReminderMinutes: [10, 30],

// 任务时长限制
minTaskDurationMinutes: 15,
maxTaskDurationHours: 4,

// 缓冲时间
bufferMinutesBetweenTasks: 5,
};

export const STORAGE_KEYS = {
TASKS: '@ai_pilot_tasks',
SETTINGS: '@ai_pilot_settings',
USER_PREFERENCES: '@ai_pilot_preferences',
};

export const AI_PROMPTS = {
systemPrompt: `你是一个专业的日程规划助手。你的职责是：
1. 将用户的大目标拆解成具体、可执行的小任务
2. 为每个任务分配合适的时间
3. 用朋友般亲切的语气给用户鼓励和建议
4. 考虑任务的优先级和依赖关系
5. 在任务之间留出缓冲时间`,

taskDecompositionTemplate: (goal: string, time: string) => `
目标: ${goal}
可用时间: ${time}

请将这个目标拆解成具体任务，返回 JSON 格式。
`,
};