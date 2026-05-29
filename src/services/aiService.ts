// src/services/aiService.ts
import { TaskInput, AITaskResponse, Task } from '../types/task';

// ============================================================
// LLM API 配置
// ============================================================
const API_CONFIG = {
    baseURL: 'https://api.deepseek.com',
    apiKey: 'sk-168f9756a5854989a05db3ea7f0f178f',
    model: 'deepseek-chat',
};

// ============================================================
// 日程规划 — 构建提示词
// ============================================================

const buildPrompt = (input: TaskInput): string => {
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN', { hour12: false });
    const todayISO = now.toISOString().split('T')[0]; // "2026-05-15"

    return `你是一个专业的日程规划助手。用户会给你一个目标，你需要将其拆解成具体、可执行的任务。

⚠️ 极其重要的时间约束（违反则整个计划作废）：
- 当前真实时间是：${currentTime}
- 今天的日期是：${todayISO}
- 你生成的所有任务的 startTime 和 endTime，必须使用今天（${todayISO}）的真实日期
- 第一个任务的开始时间必须从「${currentTime}」之后开始顺延，绝不允许生成过去的时间
- 绝不允许捏造年份（如 2024 年），年份必须是当前年份
- 时间格式必须为 ISO 8601：例如 "${todayISO}T14:30:00"

用户目标: ${input.userGoal}
可用时间: ${input.availableTime}
${input.startDate ? `用户设定的开始日期: ${input.startDate.toLocaleDateString('zh-CN')}` : ''}
${input.endDate ? `用户设定的截止日期: ${input.endDate.toLocaleDateString('zh-CN')}` : ''}

请返回一个 JSON 格式的任务列表，格式如下：
{
    "tasks": [
        {
            "title": "任务名称",
            "startTime": "${todayISO}T14:30:00",
            "endTime": "${todayISO}T15:30:00",
            "aiMessage": "AI 对这个任务的鼓励性消息，用朋友般亲切的语气"
        }
    ],
    "summary": "整体计划的简要总结"
}

要求：
1. 任务要具体、可执行、有时间限制
2. 每个任务的时长要合理（通常 25-60 分钟为宜）
3. aiMessage 要有亲和力，像朋友在鼓励你
4. 任务之间要留有 5-10 分钟缓冲时间
5. 只返回 JSON，不要有其他文字`;
};

// ============================================================
// 日程规划 — 拆解目标
// ============================================================

export const decomposeGoal = async (
    input: TaskInput,
    thinkingDepth: 'fast' | 'standard' | 'deep' = 'standard',
): Promise<AITaskResponse> => {
    try {
        const now = new Date();
        const currentTime = now.toLocaleString('zh-CN', { hour12: false });

        // ── 三挡引擎参数 ──
        const depthConfig = {
            fast: {
                model: 'deepseek-chat',
                systemSuffix: '\n\n你是一个极速效率助手。请跳过任何寒暄和多余的解释，直接用最精简的粗颗粒度 Markdown 列表输出计划骨架。执行速度第一。',
                temperature: 0.1,
            },
            standard: {
                model: 'deepseek-chat',
                systemSuffix: '',
                temperature: 0.7,
            },
            deep: {
                model: 'deepseek-reasoner',
                systemSuffix: '\n\n你是一位顶级的项目管理大师。请利用深度思维链（Think step by step），深入分析实现该目标的前置条件、潜在风险，并分配包含缓冲时间的高精度时间块。输出一份极其详尽且抗脆弱的执行方案。',
                temperature: undefined, // reasoner 模型不传 temperature
            },
        };

        const config = depthConfig[thinkingDepth];

        const body: Record<string, any> = {
            model: config.model,
            messages: [
                {
                    role: 'system',
                    content: `你是一个专业的日程规划助手，擅长将大目标拆解成小任务。只返回 JSON 格式数据。

⚠️ 当前真实时间是 ${currentTime}。你生成的所有任务的 startTime 必须在这个时间之后，绝不允许生成过去的日期或捏造年份。${config.systemSuffix}`,
                },
                {
                    role: 'user',
                    content: buildPrompt(input),
                },
            ],
            response_format: { type: 'json_object' },
        };

        if (config.temperature !== undefined) {
            body.temperature = config.temperature;
        }

        const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        const parsed: AITaskResponse = JSON.parse(content);

        parsed.tasks = parsed.tasks.map(task => ({
            ...task,
            startTime: new Date(task.startTime),
            endTime: new Date(task.endTime),
        }));

        return parsed;
    } catch (error) {
        console.error('AI 服务错误:', error);
        throw error;
    }
};

// ============================================================
// 日程规划 — 重排错过的任务
// ============================================================

export const rescheduleMissedTasks = async (
    missedTasks: Task[],
    remainingTasks: Task[],
    availableSlots: string[]
): Promise<AITaskResponse> => {
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN', { hour12: false });
    const todayISO = now.toISOString().split('T')[0];

    const prompt = `以下任务被用户错过了，需要重新安排：

⚠️ 当前真实时间是：${currentTime}，今天日期是 ${todayISO}。所有重新安排的任务必须从这个时间之后开始，使用今天的真实日期，禁止使用过去的时间或捏造年份。时间格式必须为 ISO 8601（如 "${todayISO}T14:30:00"）。

错过的任务:
${missedTasks.map(t => `- ${t.title} (原定: ${t.startTime.toLocaleString('zh-CN')})`).join('\n')}

剩余任务:
${remainingTasks.map(t => `- ${t.title} (${t.startTime.toLocaleString('zh-CN')} - ${t.endTime.toLocaleString('zh-CN')})`).join('\n')}

可用时间段:
${availableSlots.join(', ')}

请返回重新安排后的任务列表 (JSON 格式)，格式同上。`;

    try {
        const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是日程规划助手，擅长重新安排任务。只返回 JSON 格式数据。

⚠️ 当前真实时间是 ${currentTime}。你生成的所有任务的 startTime 必须在这个时间之后，绝不允许生成过去的日期或捏造年份。`,
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        });

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        const parsed: AITaskResponse = JSON.parse(content);

        parsed.tasks = parsed.tasks.map(task => ({
            ...task,
            startTime: new Date(task.startTime),
            endTime: new Date(task.endTime),
        }));

        return parsed;
    } catch (error) {
        console.error('重排任务错误:', error);
        throw error;
    }
};

// ============================================================
// 🤖 AI 私人导师 — 学习建议
// ============================================================

/**
 * 根据用户对某知识点的掌握反馈，调用 LLM 生成个性化 AI 辅导建议。
 *
 * @param taskTitle    — 当前任务/知识点名称
 * @param feedbackType — 用户反馈类型（"模糊" 或 "全忘了"）
 * @returns AI 生成的辅导文本（Markdown 格式）
 */
export const getStudyAdvice = async (
    taskTitle: string,
    feedbackType: string
): Promise<string> => {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content:
                            '你是一位极其严厉但也极其专业的顶尖考研名师，精通计算机考研408、考研英语和数学。你说话一针见血，直击痛点。只提供具体的方法论（如：长难句怎么拆、代码逻辑怎么背），绝对不准说鼓励的废话。',
                    },
                    {
                        role: 'user',
                        content: `我刚刚复习了任务：【${taskTitle}】。我的掌握程度是：【${feedbackType}】。请给我具体的学习建议和提分方法。限制在150字以内，使用Markdown排版，包含Emoji，分2-3个清晰的步骤。`,
                    },
                ],
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content: string | undefined = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        return content.trim();
    } catch (error) {
        console.error('AI 导师请求失败:', error);

        return '🔌 AI 导师断网啦，建议先去喝杯水，对着错题本深呼吸一下再来！';
    }
};

// ============================================================
// 🔮 AI 诅咒卡生成 — 为「全忘了」的知识点即时出惩罚题
// ============================================================

/**
 * 当用户对某知识点选择「全忘了」时，调用 LLM 生成一道惩罚性题目，
 * 强迫用户立即进行提取练习。
 *
 * @param taskTitle — 用户遗忘的知识点/任务名称
 * @returns AI 生成的惩罚题目文本（≤30 字）
 */
export const generateCurseTask = async (taskTitle: string): Promise<string> => {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content:
                            '你是一位极其无情、只看结果的硬核考研导师。学生刚刚在复习时按下了「全忘了」。',
                    },
                    {
                        role: 'user',
                        content: `学生忘记的知识点是：【${taskTitle}】。请直接给他出一道最核心的【填空题】或【简答题】强迫他回忆。要求：直接给出题目，绝对不准说任何开场白或废话，字数严格限制在 30 字以内！`,
                    },
                ],
                temperature: 0.8,
                max_tokens: 80,
            }),
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content: string | undefined = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        return content.trim();
    } catch (error) {
        console.error('诅咒卡生成失败:', error);
        return '说出它的 3 个核心要素！';
    }
};
// ==========================================
// 记忆卡片专属 AI 翻译引擎
// ==========================================
export const getWordDefinition = async (word: string): Promise<string> => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个精通计算机科学和英语的极简词典。请直接给出该单词或短语的中文核心释义。不要任何前置或后置的废话，不要拼音，只输出中文释义。'
          },
          {
            role: 'user',
            content: word
          }
        ],
        temperature: 0.3, // 降低温度，让词典翻译更严谨准确
      }),
    });

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error('API 返回数据格式异常');
    }
  } catch (error) {
    console.error('AI 翻译引擎请求失败:', error);
    return '翻译失败，请检查网络或 API 配置';
  }
};
// @ts-ignore
export const verifyAnswerWithAI = async (english: string, standardChinese: string, userAnswer: string): Promise<boolean> => {
  try {
    // ⚠️ 如果你之前的密钥名字叫 EXPO_PUBLIC_API_KEY，一定要把下面这行改掉！
    const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY as string; 
    
    console.log("🔥 [AI判卷发起] 单词:", english, "标准:", standardChinese, "用户:", userAnswer);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个宽容的英语老师。判断用户的中文回答是否能准确表达该英文单词的核心意思（同义词完全算对）。如果算对，请只回答 TRUE；如果算错，请只回答 FALSE。不要任何解释。'
          },
          {
            role: 'user',
            content: `单词：${english}\n标准答案：${standardChinese}\n用户回答：${userAnswer}`
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();
    console.log("🤖 [AI原始返回数据]:", data); // 抓捕 API 报错的铁证！

    // 如果 API 告诉你密钥错了、余额不足等问题
    if (data.error) {
      console.error("❌ [API报错]:", data.error.message);
      return false;
    }

    const result = data.choices[0].message.content.trim().toUpperCase();
    console.log("📝 [AI最终裁决]:", result);

    // 终极容错：不管 AI 说了啥废话，只要包含这些词，通通算对！
    if (result.includes('TRUE') || result.includes('YES') || result.includes('正确') || result.includes('算对') || result.includes('可以')) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('💥 [代码崩溃]:', error);
    return false;
  }
};