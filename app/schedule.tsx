// app/schedule.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { TaskInput } from '../src/components';
import { useTaskStore } from '../src/store/taskStore';
import { decomposeGoal, getStudyAdvice, generateCurseTask } from '../src/services/aiService';
import { TaskInput as TaskInputType, Task } from '../src/types/task';
import { formatTime, getDurationInMinutes, formatDuration } from '../src/utils/dateUtils';
import { useRouter } from 'expo-router';

// ============================================================
// 🎨 科目感知卡片皮肤系统
// ============================================================

interface CardTheme {
  bg: string;
  borderLeft: string;
  accent: string;
  accentBg: string;
  icon: string;
  label: string;
  labelColor: string;
  titleColor: string;
}

const getCardTheme = (title: string): CardTheme => {
  const t = title.toLowerCase();

  // 诅咒卡 — 必须在最前面判断
  if (t.includes('🔥') || t.includes('惩罚')) {
    return {
      bg: '#FEF2F2',
      borderLeft: '#DC2626',
      accent: '#DC2626',
      accentBg: '#FEE2E2',
      icon: 'skull',
      label: '诅咒惩罚',
      labelColor: '#DC2626',
      titleColor: '#991B1B',
    };
  }

  // 休息卡
  if (t.includes('休息') || t.includes('放松') || t.includes('午休') || t.includes('茶歇')) {
    return {
      bg: '#ECFDF5',
      borderLeft: '#10B981',
      accent: '#10B981',
      accentBg: '#D1FAE5',
      icon: 'coffee',
      label: '休息驿站',
      labelColor: '#065F46',
      titleColor: '#065F46',
    };
  }

  // 数据结构与算法
  if (
    t.includes('数据结构') || t.includes('栈') || t.includes('树') ||
    t.includes('队列') || t.includes('链表') || t.includes('图') ||
    t.includes('排序') || t.includes('查找') || t.includes('算法') ||
    t.includes('遍历') || t.includes('哈希')
  ) {
    return {
      bg: '#EFF6FF',
      borderLeft: '#3B82F6',
      accent: '#3B82F6',
      accentBg: '#DBEAFE',
      icon: 'code',
      label: '数据结构',
      labelColor: '#1D4ED8',
      titleColor: '#1E3A5F',
    };
  }

  // 计算机组成原理
  if (
    t.includes('计组') || t.includes('指令') || t.includes('cpu') ||
    t.includes('内存') || t.includes('总线') || t.includes('存储') ||
    t.includes('运算器') || t.includes('控制器') || t.includes('计算机组成') ||
    t.includes('寄存器') || t.includes('流水线') || t.includes('cache')
  ) {
    return {
      bg: '#FFF5F5',
      borderLeft: '#DC2626',
      accent: '#DC2626',
      accentBg: '#FEE2E2',
      icon: 'microchip',
      label: '计算机组成',
      labelColor: '#B91C1C',
      titleColor: '#7F1D1D',
    };
  }

  // 操作系统
  if (
    t.includes('进程') || t.includes('线程') || t.includes('内核') ||
    t.includes('操作系统') || t.includes('死锁') || t.includes('调度') ||
    t.includes('文件系统') || t.includes('虚拟内存') || t.includes('中断') ||
    t.includes('同步') || t.includes('信号量')
  ) {
    return {
      bg: '#ECFDF5',
      borderLeft: '#059669',
      accent: '#059669',
      accentBg: '#D1FAE5',
      icon: 'cogs',
      label: '操作系统',
      labelColor: '#065F46',
      titleColor: '#064E3B',
    };
  }

  // 计算机网络
  if (
    t.includes('网络') || t.includes('协议') || t.includes('tcp') ||
    t.includes('udp') || t.includes('ip') || t.includes('http') ||
    t.includes('dns') || t.includes('路由') || t.includes('osi') ||
    t.includes('传输层') || t.includes('应用层')
  ) {
    return {
      bg: '#FFFBEB',
      borderLeft: '#D97706',
      accent: '#D97706',
      accentBg: '#FEF3C7',
      icon: 'wifi',
      label: '计算机网络',
      labelColor: '#92400E',
      titleColor: '#78350F',
    };
  }

  // 英语 / 政治 / 公共课
  if (
    t.includes('英语') || t.includes('单词') || t.includes('阅读') ||
    t.includes('翻译') || t.includes('写作') || t.includes('政治') ||
    t.includes('马原') || t.includes('毛概') || t.includes('史纲') ||
    t.includes('思修')
  ) {
    return {
      bg: '#F5F3FF',
      borderLeft: '#7C3AED',
      accent: '#7C3AED',
      accentBg: '#EDE9FE',
      icon: 'book-open',
      label: '公共课',
      labelColor: '#6D28D9',
      titleColor: '#4C1D95',
    };
  }

  // 数学
  if (
    t.includes('数学') || t.includes('线代') || t.includes('概率') ||
    t.includes('高数') || t.includes('微积分') || t.includes('函数')
  ) {
    return {
      bg: '#FFF7ED',
      borderLeft: '#EA580C',
      accent: '#EA580C',
      accentBg: '#FFEDD5',
      icon: 'square-root-alt',
      label: '数学',
      labelColor: '#C2410C',
      titleColor: '#7C2D12',
    };
  }

  // 默认
  return {
    bg: '#F9FAFB',
    borderLeft: '#6B7280',
    accent: '#6B7280',
    accentBg: '#F3F4F6',
    icon: 'graduation-cap',
    label: '学习任务',
    labelColor: '#4B5563',
    titleColor: '#1F2937',
  };
};

// ============================================================
// 🏠 主屏幕组件
// ============================================================

export default function HomeScreen() {
  const {
    tasks,
    addTasks,
    updateTaskStatus,
    updateTaskMeta,
    moveTaskToEnd,
    deleteTask,
    isLoading,
    setLoading,
    error,
    setError,
  } = useTaskStore();

  const router = useRouter();

  const [isReady, setIsReady] = useState(false);

  // ============================================
  // ❤️ 进度状态
  // ============================================
  const maxHp = 13;
  const [currentHp, setCurrentHp] = useState(13);

  // ============================================
  // 💀 Game Over 弹窗
  // ============================================
  const [gameOverVisible, setGameOverVisible] = useState(false);

  // ============================================
  // ☕ 休息回血提示
  // ============================================
  const [healToast, setHealToast] = useState<string | null>(null);

  // ============================================
  // 🔮 AI 惩罚卡生成中 — 防止重复点击
  // ============================================
  const [isGeneratingCurse, setIsGeneratingCurse] = useState(false);

  // ============================================
  // ⚙️ 思考深度 Speed Dial
  // ============================================
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [aiThinkingDepth, setAiThinkingDepth] = useState<'fast' | 'standard' | 'deep'>('standard');

  // ============================================
  // 🃏 牌库体系：从 tasks 衍生三区
  // ============================================
  const discardPile = useMemo(
    () => tasks.filter((t) => t.status === 'completed'),
    [tasks],
  );

  const activePool = useMemo(
    () => tasks.filter((t) => t.status === 'pending'),
    [tasks],
  );

  const hand = useMemo(() => activePool.slice(0, 3), [activePool]);

  // ============================================
  // 🧠 掌握程度反馈弹窗 — 状态管理
  // ============================================
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ============================================
  // 🤖 AI 导师辅导 — 状态管理
  // ============================================
  const [isAiCoaching, setIsAiCoaching] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<'模糊' | '全忘了' | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (currentHp <= 0) {
      setGameOverVisible(true);
    }
  }, [currentHp]);

  useEffect(() => {
    if (healToast) {
      const timer = setTimeout(() => setHealToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [healToast]);

  const initApp = async () => {
    try {
      setIsReady(true);
    } catch (err) {
      console.error('初始化失败:', err);
      setIsReady(true);
    }
  };

  // ============================================
  // 🩸 / 💚 进度操作
  // ============================================
  const handleDamage = (amount: number = 1) => {
    setCurrentHp((prev) => Math.max(0, prev - amount));
  };

  const handleHeal = (amount: number = 1) => {
    setCurrentHp((prev) => Math.min(maxHp, prev + amount));
  };

  // ============================================
  // 💀 Game Over 操作
  // ============================================
  const handleRevive = () => {
    setCurrentHp(3);
    setGameOverVisible(false);
  };

  const handleEndSession = () => {
    setGameOverVisible(false);
  };

  // ============================================
  // 📋 提交新目标 → AI 拆解
  // ============================================
  const handleSubmit = async (input: TaskInputType) => {
    setLoading(true);
    setError(null);
    try {
      const response = await decomposeGoal(input, aiThinkingDepth);
      if (response.tasks.length === 0) {
        setError('AI 未能生成任务，请尝试更具体的目标描述');
        return;
      }
      addTasks(response.tasks);
      if (response.summary) {
        console.log('AI 总结:', response.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成任务失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 艾宾浩斯间隔 & 休息关键字
  // ============================================
  const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];
  const BREAK_KEYWORDS = ['休息', '放松', '午休', '小憩', '吃饭', '用餐', '茶歇', '运动', '散步'];

  // ============================================
  // 🎯 任务完成入口
  // ============================================
  const handleComplete = (id: string) => {
    if (currentHp <= 0) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const isBreakTask =
      BREAK_KEYWORDS.some((kw) => task.title.includes(kw)) ||
      (task as any).type === 'break';

    if (isBreakTask) {
      updateTaskStatus(id, 'completed');
      handleHeal(1);
      const msg = '☕ 休息驿站：恢复 1 点精神力！';
      setHealToast(msg);
      console.log(msg);
      return;
    }

    setSelectedTaskId(id);
    setFeedbackModalVisible(true);
  };

  // ============================================
  // 🧠 关闭弹窗 & 清理状态
  // ============================================
  const dismissModal = () => {
    setFeedbackModalVisible(false);
    setSelectedTaskId(null);
    setIsAiCoaching(false);
    setAiAdvice(null);
    setPendingFeedback(null);
    setIsGeneratingCurse(false);
  };

  // ============================================
  // ⚔️ 结算 —「秒懂」和「模糊」
  // ============================================
  const resolveTask = (taskId: string, feedback: '秒懂' | '模糊') => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentStage: number = (task as any).reviewStage ?? 0;
    let nextStage: number;
    if (feedback === '秒懂') {
      nextStage = Math.min(EBBINGHAUS_INTERVALS.length - 1, currentStage + 1);
    } else {
      nextStage = Math.max(0, currentStage - 1);
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + EBBINGHAUS_INTERVALS[nextStage]);

    updateTaskMeta(taskId, {
      reviewStage: nextStage,
      nextReviewDate: nextDate.toISOString(),
      lastStudyDate: new Date().toISOString(),
    } as any);

    if (feedback === '秒懂') {
      updateTaskStatus(taskId, 'completed');
    } else {
      moveTaskToEnd(taskId);
    }

    dismissModal();
  };

  // ============================================
  // 🔮 衍生惩罚卡 — AI 生成惩罚题并插入牌库顶
  // ============================================
  const insertCurseCard = (originTask: Task, aiQuestion: string) => {
    const curseCard: Task = {
      id: `curse-${Date.now()}`,
      title: `🔥 惩罚题：${aiQuestion}`,
      startTime: new Date(),
      endTime: new Date(),
      aiMessage: `导师针对你遗忘的「${originTask.title}」出了一道惩罚题，请认真作答。`,
      status: 'pending',
    };

    const currentTasks = useTaskStore.getState().tasks;
    useTaskStore.setState({ tasks: [curseCard, ...currentTasks] });
  };

  // ============================================
  // 💔 全忘了·异步结算
  // ============================================
  const handleCurseResolution = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setIsGeneratingCurse(true);

    let aiQuestion: string;
    try {
      aiQuestion = await generateCurseTask(task.title);
    } catch {
      aiQuestion = '说出它的 3 个核心要素！';
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + EBBINGHAUS_INTERVALS[0]);

    updateTaskMeta(taskId, {
      reviewStage: 0,
      nextReviewDate: nextDate.toISOString(),
      lastStudyDate: new Date().toISOString(),
    } as any);

    moveTaskToEnd(taskId);
    handleDamage(1);
    insertCurseCard(task, aiQuestion);

    console.log(`💔 遭受重创！HP -1 (剩余: ${Math.max(0, currentHp - 1)})`);
    dismissModal();
  };

  // ============================================
  // 🧠 反馈处理入口
  // ============================================
  const handleFeedback = async (feedback: '秒懂' | '模糊' | '全忘了') => {
    if (!selectedTaskId) return;
    if (currentHp <= 0) return;
    if (isGeneratingCurse) return;

    if (feedback === '秒懂') {
      resolveTask(selectedTaskId, '秒懂');
      return;
    }

    if (feedback === '全忘了') {
      handleCurseResolution(selectedTaskId);
      return;
    }

    // 🤔 模糊 → AI 辅导
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    setPendingFeedback(feedback);
    setIsAiCoaching(true);
    setAiAdvice(null);

    try {
      const advice = await getStudyAdvice(task.title, feedback);
      setAiAdvice(advice);
    } catch {
      setAiAdvice(
        'AI 导师暂时无法连接。\n\n建议明天再复习一遍这个知识点，回忆的关键在于在遗忘临界点进行提取练习。',
      );
    } finally {
      setIsAiCoaching(false);
    }
  };

  const handleAcceptAdvice = () => {
    if (!selectedTaskId || !pendingFeedback) return;
    if (currentHp <= 0) return;
    resolveTask(selectedTaskId, '模糊');
  };

  const handleDelete = (id: string) => {
    deleteTask(id);
  };

  const handleTaskPress = (task: Task) => {
    console.log('任务详情:', task.title);
  };

  // ============================================
  // 🖥 加载态
  // ============================================
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>初始化中...</Text>
      </View>
    );
  }

  const hpPercent = currentHp / maxHp;
  const isHpLow = currentHp <= 4;
  const isHpCritical = currentHp <= 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ============================================ */}
      {/* 🏰 极简黑白头部                                  */}
      {/* ============================================ */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.6}>
            <FontAwesome5 name="arrow-left" size={16} color="#000000" solid />
            <Text style={styles.backBtnText}>返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>智能日程</Text>
        </View>

        <View style={styles.progressRow}>
          <FontAwesome5
            name="heart"
            size={16}
            color="#000000"
            solid
          />
          <Text style={styles.progressLabel}>进度</Text>
          <View style={styles.progressTrackOuter}>
            <View style={styles.progressTrackInner}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${hpPercent * 100}%` },
                ]}
              />
            </View>
          </View>
          <Text style={styles.progressText}>
            {currentHp}/{maxHp}
          </Text>
        </View>
      </View>

      {/* ============================================ */}
      {/* 浅色内容区                                      */}
      {/* ============================================ */}
      <View style={styles.contentArea}>
        {/* ☕ 休息回血提示 Toast */}
        {healToast && (
          <View style={styles.healToast}>
            <FontAwesome5 name="coffee" size={14} color="#065F46" solid style={styles.healToastIcon} />
            <Text style={styles.healToastText}>{healToast}</Text>
          </View>
        )}

        {/* ⚠️ 错误提示 */}
        {error && (
          <View style={styles.errorBanner}>
            <FontAwesome5 name="exclamation-triangle" size={14} color="#DC2626" solid />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ============================================ */}
        {/* 📝 悬浮输入卡片                                  */}
        {/* ============================================ */}
        <View style={styles.inputCard}>
          <TaskInput onSubmit={handleSubmit} isLoading={isLoading} />
        </View>


        {/* ============================================ */}
        {/* 🃏 任务卡片区域                                  */}
        {/* ============================================ */}
        <ScrollView
          style={styles.taskScroll}
          contentContainerStyle={
            hand.length === 0 ? styles.taskScrollEmpty : styles.taskScrollContent
          }
          showsVerticalScrollIndicator={false}
        >
          {hand.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome5 name="calendar-check" size={60} color="#DBEAFE" solid />
              <Text style={styles.emptyStateTitle}>今日待办已清空</Text>
              <Text style={styles.emptyStateSubtitle}>
                点击上方生成计划添加新任务
              </Text>
            </View>
          ) : (
            hand.map((task) => {
              const theme = getCardTheme(task.title);
              const duration = getDurationInMinutes(task.startTime, task.endTime);

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskCard,
                    { backgroundColor: theme.bg, borderLeftColor: theme.borderLeft },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleTaskPress(task)}
                >
                  {/* 卡片顶栏：图标 + 科目标签 + 状态 */}
                  <View style={styles.taskCardHeader}>
                    <View style={styles.taskCardHeaderLeft}>
                      <View style={[styles.taskCardIconCircle, { backgroundColor: theme.accentBg }]}>
                        <FontAwesome5 name={theme.icon} size={14} color={theme.accent} solid />
                      </View>
                      <View style={[styles.taskCardBadge, { backgroundColor: theme.accentBg }]}>
                        <Text style={[styles.taskCardBadgeText, { color: theme.labelColor }]}>
                          {theme.label}
                        </Text>
                      </View>
                    </View>
                    {task.status === 'pending' ? (
                      <View style={styles.statusDot}>
                        <View style={[styles.statusDotInner, { backgroundColor: theme.accent }]} />
                      </View>
                    ) : null}
                  </View>

                  {/* 标题 */}
                  <Text style={[styles.taskCardTitle, { color: theme.titleColor }]} numberOfLines={2}>
                    {task.title}
                  </Text>

                  {/* AI 讯息 */}
                  {task.aiMessage ? (
                    <Text style={styles.taskCardAiMessage} numberOfLines={2}>
                      {task.aiMessage}
                    </Text>
                  ) : null}

                  {/* 底部：时间 + 操作按钮 */}
                  <View style={styles.taskCardFooter}>
                    <View style={styles.taskCardTimeGroup}>
                      <FontAwesome5 name="clock" size={11} color="#9CA3AF" solid style={{ marginRight: 5 }} />
                      <Text style={styles.taskCardTime}>
                        {formatTime(task.startTime)} · {formatDuration(duration)}
                      </Text>
                    </View>

                    <View style={styles.taskCardActions}>
                      <TouchableOpacity
                        style={[styles.taskCardActionBtn, styles.taskCardCompleteBtn]}
                        onPress={() => handleComplete(task.id)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="check" size={12} color="#FFFFFF" solid />
                        <Text style={styles.taskCardActionBtnText}>完成</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.taskCardActionBtn, styles.taskCardDeleteBtn]}
                        onPress={() => handleDelete(task.id)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="trash-alt" size={12} color="#FFFFFF" solid />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ============================================ */}
      {/* 📊 底部状态栏                                    */}
      {/* ============================================ */}
      <View style={styles.footer}>
        <FontAwesome5 name="archive" size={13} color="#94A3B8" solid style={{ marginRight: 8 }} />
        <Text style={styles.footerText}>
          已完成任务: {discardPile.length} 项
        </Text>
      </View>

      {/* ============================================ */}
      {/* ⚙️ 思考深度 Speed Dial                          */}
      {/* ============================================ */}
      <View style={styles.speedDialContainer}>
        {isSpeedDialOpen && (
          <View style={styles.speedDialMenu}>
            {([
              { key: 'fast', label: '极速', icon: 'zap' },
              { key: 'standard', label: '标准', icon: 'disc' },
              { key: 'deep', label: '深度', icon: 'layers' },
            ] as const).map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.speedDialItem}
                activeOpacity={0.7}
                onPress={() => {
                  setAiThinkingDepth(item.key);
                  setIsSpeedDialOpen(false);
                }}
              >
                <Feather name={item.icon} size={14} color="#000000" />
                <Text style={styles.speedDialItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.speedDialTrigger}
          activeOpacity={0.7}
          onPress={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
        >
          <Feather
            name={aiThinkingDepth === 'fast' ? 'zap' : aiThinkingDepth === 'deep' ? 'layers' : 'disc'}
            size={16}
            color="#000000"
          />
          <Text style={styles.speedDialTriggerText}>
            {aiThinkingDepth === 'fast' ? '极速' : aiThinkingDepth === 'deep' ? '深度' : '标准'}
          </Text>
          <Feather name="chevron-up" size={14} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* ============================================ */}
      {/* 🧠 掌握程度反馈弹窗                                */}
      {/* ============================================ */}
      <Modal
        transparent
        visible={feedbackModalVisible}
        animationType="fade"
        onRequestClose={dismissModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* ========================================== */}
            {/* 状态 D：AI 惩罚卡出题中                        */}
            {/* ========================================== */}
            {isGeneratingCurse ? (
              <>
                <View style={styles.curseSpinnerWrap}>
                  <FontAwesome5 name="fire" size={40} color="#EF4444" solid />
                </View>
                <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 16 }} />
                <Text style={styles.curseLoadingTitle}>导师正在出题</Text>
                <Text style={styles.curseLoadingSubtitle}>
                  遗忘的代价由试炼来偿还
                </Text>
              </>
            ) : aiAdvice !== null ? (
              /* ========================================== */
              /* 状态 C：AI 建议展示                          */
              /* ========================================== */
              <>
                <View style={styles.adviceHeader}>
                  <View style={styles.adviceAvatar}>
                    <FontAwesome5 name="user-graduate" size={22} color="#6366F1" solid />
                  </View>
                  <Text style={styles.adviceTitle}>AI 导师的建议</Text>
                </View>
                <View style={styles.adviceBubble}>
                  <ScrollView
                    style={styles.adviceScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.adviceText}>{aiAdvice}</Text>
                  </ScrollView>
                </View>
                <TouchableOpacity
                  style={styles.acceptAdviceBtn}
                  activeOpacity={0.7}
                  onPress={handleAcceptAdvice}
                >
                  <FontAwesome5 name="check-circle" size={18} color="#FFFFFF" solid style={{ marginRight: 8 }} />
                  <Text style={styles.acceptAdviceBtnText}>收下建议并完成复习</Text>
                </TouchableOpacity>
              </>
            ) : isAiCoaching ? (
              /* ========================================== */
              /* 状态 B：AI 辅导加载中                        */
              /* ========================================== */
              <>
                <ActivityIndicator size="large" color="#6366F1" style={{ marginBottom: 20 }} />
                <Text style={styles.coachingTitle}>AI 导师正在思考...</Text>
                <Text style={styles.coachingSubtitle}>
                  正在为你生成专属记忆策略
                </Text>
              </>
            ) : (
              /* ========================================== */
              /* 状态 A：反馈选项（默认）                       */
              /* ========================================== */
              <>
                <Text style={styles.modalTitle}>掌握得怎么样？</Text>
                <Text style={styles.modalSubtitle}>
                  诚实反馈能帮助算法更准确地为你安排复习
                </Text>

                {/* 秒懂 */}
                <TouchableOpacity
                  style={[styles.feedbackBtn, styles.feedbackBtnEasy]}
                  activeOpacity={0.7}
                  onPress={() => handleFeedback('秒懂')}
                >
                  <View style={[styles.feedbackIconWrap, { backgroundColor: '#D1FAE5' }]}>
                    <FontAwesome5 name="check-double" size={22} color="#10B981" solid />
                  </View>
                  <View style={styles.feedbackTextGroup}>
                    <Text style={styles.feedbackLabel}>秒懂</Text>
                    <Text style={styles.feedbackHint}>轻松回忆，毫无压力</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={14} color="#9CA3AF" solid />
                </TouchableOpacity>

                {/* 模糊 */}
                <TouchableOpacity
                  style={[styles.feedbackBtn, styles.feedbackBtnHard]}
                  activeOpacity={0.7}
                  onPress={() => handleFeedback('模糊')}
                >
                  <View style={[styles.feedbackIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <FontAwesome5 name="brain" size={22} color="#D97706" solid />
                  </View>
                  <View style={styles.feedbackTextGroup}>
                    <Text style={styles.feedbackLabel}>模糊</Text>
                    <Text style={styles.feedbackHint}>有点印象，但不太确定</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={14} color="#9CA3AF" solid />
                </TouchableOpacity>

                {/* 全忘了 */}
                <TouchableOpacity
                  style={[styles.feedbackBtn, styles.feedbackBtnForgot]}
                  activeOpacity={0.7}
                  onPress={() => handleFeedback('全忘了')}
                >
                  <View style={[styles.feedbackIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <FontAwesome5 name="skull" size={22} color="#DC2626" solid />
                  </View>
                  <View style={styles.feedbackTextGroup}>
                    <Text style={styles.feedbackLabel}>全忘了</Text>
                    <Text style={styles.feedbackHint}>完全没印象，需要重学</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={14} color="#9CA3AF" solid />
                </TouchableOpacity>

                {/* 取消 */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.6}
                  onPress={dismissModal}
                >
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================ */}
      {/* 💀 Game Over 全屏效果                           */}
      {/* ============================================ */}
      <Modal
        transparent
        visible={gameOverVisible}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverGlow} />

          <View style={styles.gameOverCard}>
            <View style={styles.gameOverIconWrap}>
              <FontAwesome5 name="skull-crossbones" size={64} color="#DC2626" solid />
            </View>

            <Text style={styles.gameOverTitle}>精神力枯竭</Text>
            <Text style={styles.gameOverSubtitle}>
              今天的任务已经结束，休息一下再继续吧...
            </Text>

            <View style={styles.gameOverDivider} />

            <Text style={styles.gameOverHint}>
              使用一瓶精神药水，重新燃起斗志
            </Text>

            <TouchableOpacity
              style={styles.reviveBtn}
              activeOpacity={0.8}
              onPress={handleRevive}
            >
              <FontAwesome5 name="flask" size={18} color="#FFFFFF" solid style={{ marginRight: 10 }} />
              <Text style={styles.reviveBtnText}>使用药水复活 (恢复 3 点 HP)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.endSessionBtn}
              activeOpacity={0.6}
              onPress={handleEndSession}
            >
              <Text style={styles.endSessionBtnText}>结束今日修行</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ============================================================
// 🎨 样式表
// ============================================================

const styles = StyleSheet.create({
  // ── 基础容器 ──
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    color: '#000000',
    fontSize: 14,
    marginTop: 12,
  },

  // ── 沉浸式深色头部 ──
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  modeTag: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  modeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  headerTitleRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 进度条
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
    marginRight: 12,
  },
  progressTrackOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressTrackInner: {
    flex: 1,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'right',
  },
  progressTextLow: {
    color: '#F97316',
  },
  progressTextCritical: {
    color: '#EF4444',
  },

  // ── 浅色内容区 ──
  contentArea: {
    flex: 1,
  },

  // ── 回血 Toast ──
  healToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  healToastIcon: {
    marginRight: 8,
  },
  healToastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },

  // ── 错误提示 ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // ── 悬浮输入卡片 ──
  inputCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },

  // ── 任务列表 ──
  taskScroll: {
    flex: 1,
  },
  taskScrollContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  taskScrollEmpty: {
    flex: 1,
  },

  // ── 空状态 ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1D1D1F',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── 任务卡片 ──
  taskCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskCardIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taskCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  taskCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4,
  },
  taskCardAiMessage: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 12,
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  taskCardTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskCardTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  taskCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  taskCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  taskCardCompleteBtn: {
    backgroundColor: '#10B981',
  },
  taskCardDeleteBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
  },
  taskCardActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── 底部状态栏 ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // ── 悬浮设置按钮 (FAB) ──

  // ── 反馈弹窗 ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#000000',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },

  // 反馈按钮
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  feedbackBtnEasy: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  feedbackBtnHard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  feedbackBtnForgot: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  feedbackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  feedbackTextGroup: {
    flex: 1,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  feedbackHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // ── AI 辅导 ──
  coachingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  coachingSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },

  // AI 建议展示
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
  },
  adviceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3730A3',
  },
  adviceBubble: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    maxHeight: 240,
  },
  adviceScroll: {
    maxHeight: 210,
  },
  adviceText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  acceptAdviceBtn: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  acceptAdviceBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── 惩罚卡加载 ──
  curseSpinnerWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  curseLoadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 6,
  },
  curseLoadingSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Game Over ──
  gameOverOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  gameOverGlow: {
    position: 'absolute',
    top: '30%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  gameOverCard: {
    width: '100%',
    alignItems: 'center',
  },
  gameOverIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
  },
  gameOverSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  gameOverDivider: {
    width: 60,
    height: 2,
    backgroundColor: '#374151',
    marginBottom: 24,
    borderRadius: 1,
  },
  gameOverHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  reviveBtn: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  reviveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  endSessionBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  endSessionBtnText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },

  // ── Speed Dial ──
  speedDialContainer: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  speedDialMenu: {
    gap: 8,
    marginBottom: 16,
  },
  speedDialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  speedDialItemText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  speedDialTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  speedDialTriggerText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
});
