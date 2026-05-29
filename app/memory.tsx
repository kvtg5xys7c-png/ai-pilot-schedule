import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWordDefinition } from '../src/services/aiService';

// ==========================================
// 数据类型定义
// ==========================================
interface Word {
  id: string;
  english: string;
  chinese: string;
}

export default function MemoryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'input' | 'levels'>('levels');
  const [words, setWords] = useState<Word[]>([]);

  // AI 录入相关状态
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 初始化读取本地词库
  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const stored = await AsyncStorage.getItem('memory_words');
      if (stored) setWords(JSON.parse(stored));
    } catch (e) {
      console.log('读取失败', e);
    }
  };

  const saveWords = async (newWords: Word[]) => {
    try {
      await AsyncStorage.setItem('memory_words', JSON.stringify(newWords));
      setWords(newWords);
    } catch (e) {
      console.log('保存失败', e);
    }
  };

  // ==========================================
  // 核心算法：将一维数组切分为 10个/组 的多维数组
  // ==========================================
  const chunkArray = (arr: Word[], size: number) => {
    const chunked = [];
    for (let i = 0; i < arr.length; i += size) {
      chunked.push(arr.slice(i, i + size));
    }
    return chunked;
  };

  const levels = chunkArray(words, 10);

  // ==========================================
  // AI 解析与保存逻辑
  // ==========================================
  const handleAIParse = async () => {
    if (!inputText.trim()) {
      Alert.alert('提示', '请输入英文单词');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await getWordDefinition(inputText);
      setTranslatedText(result);
    } catch (error) {
      Alert.alert('错误', '无法连接到 AI，请稍后再试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCard = () => {
    if (!inputText || !translatedText) return;
    const newWord = { id: Date.now().toString(), english: inputText, chinese: translatedText };
    const newWords = [newWord, ...words];
    saveWords(newWords);
    setInputText('');
    setTranslatedText('');
    Alert.alert('成功', '卡片已保存！');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 顶部导航 ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={13} color="#000" />
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>

        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'levels' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('levels')}
          >
            <Text style={[styles.segmentText, activeTab === 'levels' && styles.segmentTextActive]}>
              卡片浏览
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'input' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('input')}
          >
            <Text style={[styles.segmentText, activeTab === 'input' && styles.segmentTextActive]}>
              新建卡片
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ========================================== */}
        {/* 模式 A：天梯关卡列表                        */}
        {/* ========================================== */}
        {activeTab === 'levels' && (
          <View style={styles.levelsContainer}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>综合词汇天梯</Text>
              <Text style={styles.pageSubtitle}>
                已收录 {words.length} 词 · 共 {levels.length} 关
              </Text>
            </View>

            {levels.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="layer-group" size={48} color="#E5E5EA" />
                <Text style={styles.emptyText}>暂无数据，请先去新建卡片</Text>
              </View>
            ) : (
              levels.slice().reverse().map((levelWords, reversedIndex) => {
                const levelNum = levels.length - reversedIndex;
                const progressWidth = `${(levelWords.length / 10) * 100}%` as any;
                const isFull = levelWords.length === 10;

                return (
                  <TouchableOpacity
                    key={`level-${levelNum}`}
                    style={styles.levelCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/level/${levelNum}` as any)}
                  >
                    <View style={styles.levelLeft}>
                      <Text style={styles.levelTitle}>Level {levelNum}</Text>
                      <Text style={styles.levelCount}>{levelWords.length}/10</Text>
                    </View>

                    <View style={styles.levelMiddle}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: progressWidth }]} />
                      </View>
                    </View>

                    <View style={styles.starContainer}>
                      <FontAwesome5 name="star" size={11} color={isFull ? '#000' : '#E5E5EA'} solid={!isFull} />
                      <FontAwesome5 name="star" size={11} color={isFull ? '#000' : '#E5E5EA'} solid={!isFull} />
                      <FontAwesome5 name="star" size={11} color={isFull ? '#000' : '#E5E5EA'} solid={!isFull} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* 模式 B：AI 录入卡片工作台                    */}
        {/* ========================================== */}
        {activeTab === 'input' && (
          <View style={styles.inputContainer}>
            <Text style={styles.sectionTitle}>AI 智能释义</Text>

            <View style={styles.inputCard}>
              <TextInput
                style={styles.textInput}
                placeholder="输入英文单词或短语..."
                placeholderTextColor="#C7C7CC"
                value={inputText}
                onChangeText={setInputText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.aiButton, (!inputText.trim() || isGenerating) && styles.aiButtonDisabled]}
                onPress={handleAIParse}
                disabled={!inputText.trim() || isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <FontAwesome5 name="magic" size={14} color="#FFF" />
                )}
                <Text style={styles.aiButtonText}>
                  {isGenerating ? '智能释义中...' : '智能释义'}
                </Text>
              </TouchableOpacity>
            </View>

            {translatedText ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>释义结果</Text>
                <Text style={styles.resultText}>{translatedText}</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveCard}>
                  <FontAwesome5 name="plus" size={13} color="#000" />
                  <Text style={styles.saveButtonText}>保存至术语库</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 样式表 — 新粗野主义 (Neo-Brutalism)
// ==========================================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
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

  // ── 分段控制器 ──
  segmentControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    padding: 3,
    backgroundColor: '#FFFFFF',
  },
  segmentBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  segmentBtnActive: {
    backgroundColor: '#000',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  segmentTextActive: {
    color: '#FFF',
  },

  // ── 页面标题区 ──
  pageHeader: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 6,
  },

  // ── 天梯列表 ──
  levelsContainer: {
    paddingBottom: 40,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  levelLeft: {
    width: 72,
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  levelCount: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 2,
  },
  levelMiddle: {
    flex: 1,
    marginHorizontal: 14,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 0,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#000',
  },
  starContainer: {
    flexDirection: 'row',
    gap: 4,
    width: 50,
    justifyContent: 'flex-end',
  },

  // ── 空状态 ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 16,
  },

  // ── AI 录入区 ──
  inputContainer: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    marginBottom: 20,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aiButton: {
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── 结果卡片 ──
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 16,
    padding: 20,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    lineHeight: 28,
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    padding: 14,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
