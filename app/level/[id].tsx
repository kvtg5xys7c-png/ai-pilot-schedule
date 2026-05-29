import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Word {
  id: string;
  english: string;
  chinese: string;
}

export default function LevelDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [levelWords, setLevelWords] = useState<Word[]>([]);

  useEffect(() => {
    loadLevelData();
  }, [id]);

  const loadLevelData = async () => {
    try {
      const stored = await AsyncStorage.getItem('memory_words');
      if (stored) {
        const allWords: Word[] = JSON.parse(stored);
        const chunked: Word[][] = [];
        for (let i = 0; i < allWords.length; i += 10) {
          chunked.push(allWords.slice(i, i + 10));
        }
        const targetIndex = Number(id) - 1;
        if (chunked[targetIndex]) {
          setLevelWords(chunked[targetIndex]);
        }
      }
    } catch (e) {
      console.log('读取关卡数据失败', e);
    }
  };

  // ── 构建纯文本节点数组 ──
  const renderWordBlock = () => {
    if (levelWords.length === 0) {
      return (
        <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>
          当前关卡空空如也
        </Text>
      );
    }

    const nodes: React.ReactNode[] = [];

    levelWords.forEach((word, index) => {
      // 单词节点
      nodes.push(
        <Text
          key={`w-${word.id}`}
          style={{
            fontSize: 32,
            fontWeight: '900',
            color: '#000000',
          }}
        >
          {word.english}
        </Text>
      );

      // 斜杠分隔符（非最后一个）
      if (index < levelWords.length - 1) {
        nodes.push(
          <Text
            key={`s-${index}`}
            style={{
              fontSize: 32,
              fontWeight: '900',
              color: '#000000',
            }}
          >
            {' / '}
          </Text>
        );
      }
    });

    return (
      <Text
        style={{
          textAlign: 'center',
          lineHeight: 48,
          padding: 24,
        }}
      >
        {nodes}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 顶部导航 ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={13} color="#000" />
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <View style={{ width: 70 }} />
      </View>

      {/* ── 标题区 ── */}
      <View style={styles.titleSection}>
        <Text style={styles.levelTitle}>LEVEL {id}</Text>
        <Text style={styles.progressHint}>
          单词掌握度 {levelWords.length}/10
        </Text>
      </View>

      {/* ── 纯文本矩阵 ── */}
      <View style={styles.matrixContainer}>
        {renderWordBlock()}
      </View>

      {/* ── 底部操作按钮 ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.8}
          onPress={() => router.push(`/review/${id}` as any)}
        >
          <FontAwesome5 name="eye" size={15} color="#FFF" />
          <Text style={styles.primaryBtnText}>一眼复习</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.8}
          onPress={() => router.push(`/challenge/${id}` as any)}
        >
          <FontAwesome5 name="bolt" size={15} color="#000" />
          <Text style={styles.secondaryBtnText}>直接挑战</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 样式表
// ============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── 顶部导航 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 2,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1.5,
  },

  // ── 标题区 ──
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  levelTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -1,
  },
  progressHint: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 6,
  },

  // ── 纯文本矩阵 ──
  matrixContainer: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },

  // ── 底部按钮 ──
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
});
