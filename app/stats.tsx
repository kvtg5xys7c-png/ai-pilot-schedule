import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar, 
  ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Polygon, Line, Text as SvgText, Circle } from 'react-native-svg';

// ==========================================
// 核心战力数据配置 (百分制)
// ==========================================
const STATS_CONFIG = [
  { name: '记忆强度', value: 85 }, 
  { name: '算法解析', value: 70 }, 
  { name: '架构设计', value: 88 }, 
  { name: '任务执行', value: 65 }, 
  { name: '营地休整', value: 95 }, 
  { name: '综合评分', value: 78 },
];

// ==========================================
// 雷达图三角函数几何参数计算
// ==========================================
const CX = 160; 
const CY = 150; 
const R = 65;  
const COUNT = STATS_CONFIG.length; 

const getCoordinates = (radius: number) => {
  return STATS_CONFIG.map((_, i) => {
    const angle = (Math.PI * 2 / COUNT) * i - Math.PI / 2;
    return {
      x: CX + radius * Math.cos(angle),
      y: CY + radius * Math.sin(angle),
    };
  });
};

export default function StatsScreen() {
  const webGrid33 = getCoordinates(R * 0.33);
  const webGrid66 = getCoordinates(R * 0.66);
  const webGrid100 = getCoordinates(R);

  const playerPoints = STATS_CONFIG.map((item, i) => {
    const angle = (Math.PI * 2 / COUNT) * i - Math.PI / 2;
    const playerRadius = R * (item.value / 100); 
    return `${CX + playerRadius * Math.cos(angle)},${CY + playerRadius * Math.sin(angle)}`;
  }).join(' ');

  const labelCoordinates = getCoordinates(R + 18);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* 状态栏改为暗色内容，适应白色背景 */}
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />
      
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.6} onPress={() => router.back()}>
          <FontAwesome5 name="chevron-left" size={16} color="#0071E3" />
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>我的数据</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.radarCard}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="chart-pie" size={16} color="#FF9500" />
            <Text style={styles.cardTitle}>能力雷达</Text>
          </View>

          <View style={styles.svgWrapper}>
            <Svg width="320" height="300">
              
              {/* 🕸️ 绘制极简浅灰背景网格 */}
              <Polygon 
                points={webGrid33.map(p => `${p.x},${p.y}`).join(' ')} 
                fill="none" stroke="#E5E5EA" strokeWidth="1" 
              />
              <Polygon 
                points={webGrid66.map(p => `${p.x},${p.y}`).join(' ')} 
                fill="none" stroke="#E5E5EA" strokeWidth="1" 
              />
              <Polygon 
                points={webGrid100.map(p => `${p.x},${p.y}`).join(' ')} 
                fill="none" stroke="#E5E5EA" strokeWidth="1.5" 
              />

              {/* 🧭 绘制极轴辐射线 */}
              {webGrid100.map((pt, idx) => (
                <Line 
                  key={`line-${idx}`} 
                  x1={CX} y1={CY} x2={pt.x} y2={pt.y} 
                  stroke="#E5E5EA" strokeWidth="1" 
                />
              ))}

              {/* ⚔️ 绘制核心战力多边形 (Apple 活力橙) */}
              <Polygon 
                points={playerPoints} 
                fill="rgba(255, 149, 0, 0.15)" 
                stroke="#FF9500" strokeWidth="2.5" 
              />

              {/* 🟢 绘制战力数据节点微粒 */}
              {STATS_CONFIG.map((item, i) => {
                const angle = (Math.PI * 2 / COUNT) * i - Math.PI / 2;
                const playerRadius = R * (item.value / 100);
                return (
                  <Circle 
                    key={`dot-${i}`}
                    cx={CX + playerRadius * Math.cos(angle)}
                    cy={CY + playerRadius * Math.sin(angle)}
                    r="4" fill="#FFFFFF" stroke="#FF9500" strokeWidth="2"
                  />
                );
              })}

              {/* 🏷️ 动态计算并渲染 6 维标签文字 */}
              {labelCoordinates.map((pt, idx) => {
                const item = STATS_CONFIG[idx];
                // 完美保留你的强迫症修复：明确限定类型
                let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                const cosValue = Math.cos((Math.PI * 2 / COUNT) * idx - Math.PI / 2);
                if (cosValue > 0.1) textAnchor = 'start';
                if (cosValue < -0.1) textAnchor = 'end';

                return (
                  <SvgText
                    key={`label-${idx}`}
                    x={pt.x}
                    y={pt.y + 4} 
                    fill="#86868B"
                    fontSize="13"
                    fontWeight="600"
                    textAnchor={textAnchor}
                  >
                    {`${item.name} ${item.value}`}
                  </SvgText>
                );
              })}
            </Svg>
          </View>
        </View>

        <View style={styles.reportList}>
          <Text style={styles.sectionTitle}>数据日志</Text>
          
          <View style={styles.logCard}>
            <View style={styles.logRow}>
              <View style={styles.logLeft}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                  <FontAwesome5 name="ghost" size={14} color="#FF3B30" />
                </View>
                <Text style={styles.logLabel}>记忆卡片总数</Text>
              </View>
              <Text style={styles.logValue}>342</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.logRow}>
              <View style={styles.logLeft}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                  <FontAwesome5 name="hourglass-half" size={14} color="#34C759" />
                </View>
                <Text style={styles.logLabel}>专注时长</Text>
              </View>
              <Text style={styles.logValue}>42.5h</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.logRow}>
              <View style={styles.logLeft}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 113, 227, 0.1)' }]}>
                  <FontAwesome5 name="crown" size={14} color="#0071E3" />
                </View>
                <Text style={styles.logLabel}>当前评级</Text>
              </View>
              <Text style={styles.logValue}>S-</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// Apple 极简白样式表
// ==========================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
  container: { flex: 1, padding: 16 },
  
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  backBtnText: { fontSize: 16, fontWeight: '500', color: '#0071E3' },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#1D1D1F' },
  navSpacer: { width: 50 },

  radarCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.04, shadowRadius: 16, elevation: 4,
    marginBottom: 24,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1D1D1F' },
  svgWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },

  reportList: { marginBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#86868B', textTransform: 'uppercase', marginBottom: 8, marginLeft: 16 },
  
  logCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 2,
  },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logLabel: { fontSize: 15, fontWeight: '500', color: '#1D1D1F' },
  logValue: { fontSize: 16, fontWeight: '600', color: '#86868B' },
  divider: { height: 1, backgroundColor: '#F2F2F7', marginLeft: 40 },
});