import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWordDefinition } from '../src/services/aiService';

// ==========================================
// 数据类型定义
// ==========================================
interface Word {
  id: string;
  english: string;
  meanings: string[];
}

export default function MemoryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'input' | 'levels'>('levels');
  const [words, setWords] = useState<Word[]>([]);
  const [levelStars, setLevelStars] = useState<Record<number, number>>({});

  // AI 录入相关状态
  const [inputText, setInputText] = useState('');
  const [meanings, setMeanings] = useState<string[]>(['']);
  const [isGenerating, setIsGenerating] = useState(false);

  // 折叠状态：记录哪些 Level 被展开了（默认全部收起）
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const toggleLevel = (levelNum: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelNum)) {
        next.delete(levelNum);
      } else {
        next.add(levelNum);
      }
      return next;
    });
  };

  const updateMeaning = (index: number, text: string) => {
    const next = [...meanings];
    next[index] = text;
    setMeanings(next);
  };
  const addMeaning = () => setMeanings([...meanings, '']);
  const removeMeaning = (index: number) => {
    if (meanings.length <= 1) return;
    setMeanings(meanings.filter((_, i) => i !== index));
  };

  // 初始化读取本地词库
  useEffect(() => {
    loadWords();
  }, []);

  // ==========================================
  // 旧数据兼容迁移
  // ==========================================
  const migrateWord = (raw: any): Word => {
    if (Array.isArray(raw.meanings)) {
      return { ...raw, meanings: raw.meanings.map((m: string) => m.trim()).filter(Boolean) };
    }
    return { id: raw.id, english: raw.english, meanings: [raw.chinese?.trim()].filter(Boolean) };
  };

  const reloadStars = async () => {
    try {
      const starStored = await AsyncStorage.getItem('level_stars');
      if (starStored) {
        const parsed = JSON.parse(starStored);
        const mapped: Record<number, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          mapped[Number(k)] = v as number;
        }
        setLevelStars(mapped);
      }
    } catch (e) {
      console.log('读取星数失败', e);
    }
  };

  const loadWords = async () => {
    try {
      const wordStored = await AsyncStorage.getItem('memory_words');
      if (wordStored) {
        setWords(JSON.parse(wordStored).map(migrateWord));
      }
    } catch (e) {
      console.log('读取失败', e);
    }
    reloadStars();
  };

  // 每次页面获得焦点时刷新星数（从挑战页返回后同步最新成绩）
  useFocusEffect(
    useCallback(() => {
      reloadStars();
    }, [])
  );

  // 仅持久化到 AsyncStorage（不触碰 state）
  const persistWords = async (data: Word[]) => {
    try {
      await AsyncStorage.setItem('memory_words', JSON.stringify(data));
    } catch (e) {
      console.log('保存失败', e);
    }
  };

  // 词库变更 → 自动同步到 AsyncStorage
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    persistWords(words);
  }, [words]);

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
  // 删除单词（带确认弹窗 · 跨平台兼容）
  // ==========================================
  const handleDeleteWord = (wordId: string, wordEnglish: string) => {
    console.log('垃圾桶被点击了', { wordId, wordEnglish });

    const doDelete = () => {
      // 函数式更新：始终基于最新 state 过滤，不依赖闭包里的 words
      setWords((prev) => {
        const updated = prev.filter((w) => w.id !== wordId);
        // 持久化最新数据
        persistWords(updated);
        return updated;
      });
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`确定要删除「${wordEnglish}」吗？此操作不可撤销。`);
      if (confirmed) doDelete();
    } else {
      Alert.alert(
        '确认删除',
        `确定要删除「${wordEnglish}」吗？此操作不可撤销。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '删除', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  };

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
      setMeanings([result]);
    } catch (error) {
      Alert.alert('错误', '无法连接到 AI，请稍后再试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCard = () => {
    const cleaned = meanings.map(m => m.trim()).filter(m => m.length > 0);
    if (!inputText.trim() || cleaned.length === 0) return;
    const newWord = { id: Date.now().toString(), english: inputText.trim(), meanings: cleaned };
    setWords((prev) => [newWord, ...prev]);
    setInputText('');
    setMeanings(['']);
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
        {/* 模式 A：单词列表（按 Level 分组 + 删除）      */}
        {/* ========================================== */}
        {activeTab === 'levels' && (
          <View style={styles.levelsContainer}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>综合词汇天梯</Text>
              <Text style={styles.pageSubtitle}>
                已收录 {words.length} 词 · 共 {levels.length} 关
              </Text>
            </View>

            {words.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="book-open" size={48} color="#E5E5EA" />
                <Text style={styles.emptyText}>词库空空如也，快去添加新单词吧</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => setActiveTab('input')}
                >
                  <Text style={styles.emptyBtnText}>去添加</Text>
                </TouchableOpacity>
              </View>
            ) : (
              levels.map((levelWords, levelIndex) => {
                const levelNum = levelIndex + 1;
                const stars = levelStars[levelNum] || 0;
                const isExpanded = expandedLevels.has(levelNum);

                return (
                  <View key={`level-${levelNum}`} style={styles.levelSection}>
                    {/* Level 标题栏 — 点击折叠/展开 */}
                    <TouchableOpacity
                      style={styles.levelHeader}
                      activeOpacity={0.7}
                      onPress={() => toggleLevel(levelNum)}
                    >
                      <View style={styles.levelHeaderLeft}>
                        <FontAwesome5
                          name={isExpanded ? 'chevron-down' : 'chevron-right'}
                          size={11}
                          color="#8E8E93"
                        />
                        <Text style={styles.levelHeaderTitle}>Level {levelNum}</Text>
                        <Text style={styles.levelHeaderCount}>{levelWords.length}/10</Text>
                      </View>
                      <View style={styles.levelHeaderRight}>
                        <View style={styles.starContainer}>
                          <FontAwesome5 name="star" size={10} color={stars >= 1 ? '#007AFF' : '#D1D1D6'} solid={stars >= 1} />
                          <FontAwesome5 name="star" size={10} color={stars >= 2 ? '#007AFF' : '#D1D1D6'} solid={stars >= 2} />
                          <FontAwesome5 name="star" size={10} color={stars >= 3 ? '#007AFF' : '#D1D1D6'} solid={stars >= 3} />
                        </View>
                        {/* 进入挑战详情 */}
                        <TouchableOpacity
                          style={styles.enterBtn}
                          onPress={() => router.push(`/level/${levelNum}` as any)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <FontAwesome5 name="arrow-right" size={10} color="#0071E3" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {/* 单词列表（可折叠） */}
                    {isExpanded &&
                      levelWords.map((word) => (
                        <View key={word.id} style={styles.wordRow}>
                          <View style={styles.wordInfo}>
                            <Text style={styles.wordEnglish} numberOfLines={1}>
                              {word.english}
                            </Text>
                            <Text style={styles.wordChinese} numberOfLines={1}>
                              {word.meanings.join('、')}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteWord(word.id, word.english)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <FontAwesome5 name="trash-alt" size={13} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
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

            {meanings.some(m => m.trim()) ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>释义结果</Text>
                {meanings.map((m, index) => (
                  <View key={index} style={styles.meaningRow}>
                    <Text style={styles.meaningIndex}>{index + 1}.</Text>
                    <TextInput
                      style={[styles.textInput, { flex: 1, minHeight: 44, marginBottom: 0 }]}
                      value={m}
                      onChangeText={(text) => updateMeaning(index, text)}
                      placeholder={`释义 ${index + 1}`}
                      placeholderTextColor="#C7C7CC"
                    />
                    {meanings.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeMeaning(index)}
                        style={styles.removeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <FontAwesome5 name="times" size={12} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={addMeaning} style={styles.addMeaningBtn}>
                  <FontAwesome5 name="plus" size={11} color="#8E8E93" />
                  <Text style={styles.addMeaningBtnText}>添加释义</Text>
                </TouchableOpacity>
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

  // ── Level 分组 ──
  levelSection: {
    marginBottom: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 4,
  },
  levelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  levelHeaderCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  levelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  enterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 单词行 ──
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  wordInfo: {
    flex: 1,
    marginRight: 12,
  },
  wordEnglish: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D1D1F',
  },
  wordChinese: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 空状态 ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
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

  // ── 多释义输入 ──
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  meaningIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    width: 20,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMeaningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 16,
  },
  addMeaningBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
