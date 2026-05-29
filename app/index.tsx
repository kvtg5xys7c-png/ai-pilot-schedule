import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ============================================================
// 卡牌配置
// ============================================================

interface CardConfig {
  title: string;
  subtitle: string;
  route: string;
  icon: string;
  accent: string;
}

const CARDS: CardConfig[] = [
  {
    title: '智能日程',
    subtitle: '每日计划与任务管理',
    route: '/schedule',
    icon: 'flag',
    accent: '#0071E3',
  },
  {
    title: '记忆卡片',
    subtitle: 'AI 辅助知识记忆',
    route: '/memory',
    icon: 'brain',
    accent: '#0071E3',
  },
  {
    title: '专注空间',
    subtitle: '白噪音与沉浸式体验',
    route: '/camp',
    icon: 'fire-alt',
    accent: '#0071E3',
  },
  {
    title: '数据洞察',
    subtitle: '多维度学习数据统计',
    route: '/stats',
    icon: 'chart-pie',
    accent: '#0071E3',
  },
];

// ============================================================
// 主屏幕
// ============================================================

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ========== Header ========== */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>今日聚焦</Text>
        <Text style={styles.headerTitle}>聚焦</Text>
        <Text style={styles.headerSubtitle}>今天想做点什么？</Text>
      </View>

      {/* ========== 2x2 四宫格 ========== */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <CardItem config={CARDS[0]} onPress={() => router.push(CARDS[0].route)} />
          <CardItem config={CARDS[1]} onPress={() => router.push(CARDS[1].route)} />
        </View>
        <View style={styles.gridRow}>
          <CardItem config={CARDS[2]} onPress={() => router.push(CARDS[2].route)} />
          <CardItem config={CARDS[3]} onPress={() => router.push(CARDS[3].route)} />
        </View>
      </View>

      {/* ========== 底部 ========== */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>咕咕嘎嘎 · 已就绪</Text>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 单张卡片组件
// ============================================================

function CardItem({ config, onPress }: { config: CardConfig; onPress: () => void }) {
  const { title, subtitle, icon, accent } = config;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardIconWrap}>
          <FontAwesome5 name={icon} size={28} color={accent} solid />
        </View>

        <View style={styles.cardTextArea}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>

        <View style={styles.cardArrowRow}>
          <Text style={styles.cardArrowLabel}>进入</Text>
          <FontAwesome5 name="arrow-right" size={12} color="#000" solid />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// 样式表 — 新粗野主义 (Neo-Brutalism)
// ============================================================

const GRID_GAP = 16;
const GRID_H_PADDING = 20;

const styles = StyleSheet.create({
  // ── 根容器 ──
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Header ──
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 28,
  },
  headerEyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    lineHeight: 22,
  },

  // ── 2x2 网格 ──
  grid: {
    flex: 1,
    paddingHorizontal: GRID_H_PADDING,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: GRID_GAP / 2,
    gap: GRID_GAP,
  },

  // ── 卡片 ──
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
  },
  cardInner: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTextArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    lineHeight: 18,
  },
  cardArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  cardArrowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },

  // ── 底部 ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#AEAEB2',
    letterSpacing: 0.3,
  },
});
