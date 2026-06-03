import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { verifyAnswerWithAI } from '../../src/services/aiService';
import { playWord } from '../../src/services/audioService';

// ==========================================
// Fisher-Yates 洗牌算法
// ==========================================
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ==========================================
// 文本清洗：只保留汉字、字母、数字，用于语义级比对
// ==========================================
function normalizeText(text: string): string {
  return text.replace(/[^一-龥a-zA-Z0-9]/g, '');
}

// ==========================================
// 数据类型
// ==========================================
interface Word {
  id: string;
  english: string;
  meanings: string[];
}

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams();
  const [levelWords, setLevelWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 测验状态
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [inputs, setInputs] = useState<string[]>(['']);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState<{ word: Word; userAnswers: string[] }[]>([]);

  const updateInput = (index: number, text: string) => {
    const next = [...inputs];
    next[index] = text;
    setInputs(next);
  };

  useEffect(() => {
    loadWords();
  }, [id]);

  // 自动播放当前单词读音（进入页面 + 每次切换下一题）
  useEffect(() => {
    if (levelWords.length > 0 && levelWords[currentIndex]) {
      playWord(levelWords[currentIndex].english);
    }
  }, [currentIndex, levelWords]);

  // ==========================================
  // 1. 读取本地数据库（含旧数据兼容迁移）
  // ==========================================
  const migrateWord = (raw: any): Word => {
    if (Array.isArray(raw.meanings)) {
      return { ...raw, meanings: raw.meanings.map((m: string) => m.trim()).filter(Boolean) };
    }
    return { id: raw.id, english: raw.english, meanings: [raw.chinese?.trim()].filter(Boolean) };
  };

  const loadWords = async () => {
    try {
      const stored = await AsyncStorage.getItem('memory_words');
      if (stored) {
        const allWords: Word[] = JSON.parse(stored).map(migrateWord);
        const chunked = [];
        for (let i = 0; i < allWords.length; i += 10) {
          chunked.push(allWords.slice(i, i + 10));
        }
        const targetIndex = Number(id) - 1;
        if (chunked[targetIndex]) {
          const level = shuffleArray(chunked[targetIndex]);
          setLevelWords(level);
          setInputs(new Array(level[0]?.meanings.length || 1).fill(''));
        }
      }
    } catch (e) {
      console.log('读取单词失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. 宽容无序集合比对（语义级匹配）
  //    - 先 normalizeText 清洗掉标点符号，只保留汉字/字母/数字
  //    - 过滤空串后，有效数量必须严格相等
  //    - 每一项都必须在标准答案中找到匹配
  // ==========================================
  const checkAnswersStrict = (userInputs: string[], correctMeanings: string[]): boolean => {
    const clean = (arr: string[]) => arr.map(s => normalizeText(s.trim())).filter(s => s.length > 0);
    const userCleaned = clean(userInputs);
    const correctCleaned = clean(correctMeanings);

    // 数量不等 → 直接判错
    if (userCleaned.length !== correctCleaned.length) return false;

    // Set 比对：每一项都必须命中（已清洗后的纯文本比对）
    const correctSet = new Set(correctCleaned);
    for (const item of userCleaned) {
      if (!correctSet.has(item)) return false;
    }
    return true;
  };

  // ==========================================
  // 3. 验证逻辑
  //    - 无论对错，点击"验证"后必进 hasSubmitted 状态
  //    - 多释义只用本地严格比对，不走 AI 兜底
  //    - 单释义才允许 AI 模糊匹配（同义词等）
  // ==========================================
  const handleVerify = async () => {
    const currentWord = levelWords[currentIndex];
    const correctMeanings = currentWord.meanings;
    const cleanedInputs = inputs.map(s => s.trim()).filter(s => s.length > 0);

    // ── 第一关：严格集合比对 ──
    if (checkAnswersStrict(inputs, correctMeanings)) {
      setIsCorrect(true);
      setScore(score + 1);
      setHasSubmitted(true);
      Keyboard.dismiss();
      return;
    }

    // ── 第二关：仅单释义场景走 AI 模糊匹配（同义词容错） ──
    if (correctMeanings.length === 1 && cleanedInputs.length === 1) {
      setIsVerifying(true);
      const isAiCorrect = await verifyAnswerWithAI(
        currentWord.english,
        correctMeanings[0],
        cleanedInputs[0],
      );
      setIsVerifying(false);

      setIsCorrect(isAiCorrect);
      if (isAiCorrect) {
        setScore(score + 1);
      } else {
        setWrongAnswers(prev => [...prev, { word: currentWord, userAnswers: cleanedInputs }]);
      }
      setHasSubmitted(true);
      Keyboard.dismiss();
      return;
    }

    // ── 第三关：判错（无论是否留空、部分填写、多填错误词） ──
    setIsCorrect(false);
    setWrongAnswers(prev => [...prev, { word: currentWord, userAnswers: cleanedInputs }]);
    setHasSubmitted(true);
    Keyboard.dismiss();
  };

  // ==========================================
  // 4. 下一题 / 结算
  // ==========================================
  const handleNext = () => {
    if (currentIndex < levelWords.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setInputs(new Array(levelWords[nextIndex].meanings.length).fill(''));
      setHasSubmitted(false);
      setIsCorrect(false);
    } else {
      setIsGameOver(true);
    }
  };

  // ==========================================
  // 5. 结算时保存星数（完美通关 +1，上限 3）
  // ==========================================
  useEffect(() => {
    if (!isGameOver) return;
    if (wrongAnswers.length > 0) return;

    const saveStar = async () => {
      try {
        const stored = await AsyncStorage.getItem('level_stars');
        const starsMap: Record<string, number> = stored ? JSON.parse(stored) : {};
        const current = starsMap[String(id)] || 0;
        if (current < 3) {
          starsMap[String(id)] = current + 1;
          await AsyncStorage.setItem('level_stars', JSON.stringify(starsMap));
        }
      } catch (e) {
        console.log('保存星数失败', e);
      }
    };
    saveStar();
  }, [isGameOver]);

  // ==========================================
  // 渲染：加载中
  // ==========================================
  if (isLoading) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>加载题目中...</Text>
      </View>
    );
  }

  // ==========================================
  // 渲染：空关卡
  // ==========================================
  if (levelWords.length === 0) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>本关卡没有单词</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
          <Text style={{ color: '#0071E3', fontSize: 16 }}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================
  // 渲染：结算页面
  // ==========================================
  if (isGameOver) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.gameOverContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.gameOverTitle}>挑战完成！</Text>
          <Text style={styles.scoreText}>{score} / {levelWords.length}</Text>

          {/* ── 错词回顾 ── */}
          {wrongAnswers.length > 0 ? (
            <View style={styles.wrongSection}>
              <Text style={styles.wrongSectionTitle}>本次错词回顾</Text>
              {wrongAnswers.map((item, index) => (
                <View key={item.word.id} style={styles.wrongCard}>
                  <Text style={styles.wrongWordEnglish}>{item.word.english}</Text>
                  {item.userAnswers.length > 0 && (
                    <Text style={styles.wrongUserAnswer}>
                      你的答案：{item.userAnswers.join('、')}
                    </Text>
                  )}
                  <Text style={styles.wrongCorrectAnswer}>
                    正确释义：{item.word.meanings.join('、')}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.perfectSection}>
              <Text style={styles.perfectText}>全部正确，太棒了！🎉</Text>
            </View>
          )}

          <TouchableOpacity style={styles.finishBtn} onPress={() => router.back()}>
            <Text style={styles.finishBtnText}>返回天梯</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // 渲染：答题页面
  // ==========================================
  const currentWord = levelWords[currentIndex];

  return (
    <SafeAreaView style={styles.root}>
      {/* KeyboardAvoidingView 包裹全部内容，避免遮罩层吞噬 header 触摸事件 */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── 顶部导航（放在 KAV 内部，确保不被遮挡） ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <FontAwesome5 name="chevron-left" size={16} color="#0071E3" />
            <Text style={styles.backBtnText}>放弃</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{currentIndex + 1} / {levelWords.length}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* ── 中间内容区 ── */}
        <View style={styles.container}>
          {/* 核心英文区 */}
          <View style={styles.wordRow}>
            <Text style={styles.wordTitle}>{currentWord.english}</Text>
            <TouchableOpacity
              onPress={() => playWord(currentWord.english)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome5 name="volume-up" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* 输入框区 */}
          <View style={styles.inputSection}>
            {inputs.map((val, index) => {
              const trimmedVal = val.trim();
              const normalizedVal = normalizeText(trimmedVal);
              const isIncluded = normalizedVal.length > 0 && currentWord.meanings.some(m => normalizeText(m) === normalizedVal);
              const isThisOneGreen = hasSubmitted && isIncluded;
              const isThisOneRed = hasSubmitted && !isCorrect && !isIncluded;

              return (
                <View key={index} style={styles.answerRow}>
                  <Text style={styles.answerIndex}>{index + 1}.</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        isThisOneGreen && styles.inputCorrect,
                        isThisOneRed && styles.inputWrong,
                      ]}
                      placeholder={`释义 ${index + 1}`}
                      placeholderTextColor="#94A3B8"
                      value={val}
                      onChangeText={(text) => updateInput(index, text)}
                      editable={!hasSubmitted}
                      autoFocus={index === 0}
                      onSubmitEditing={
                        index === inputs.length - 1
                          ? (hasSubmitted ? handleNext : handleVerify)
                          : undefined
                      }
                    />
                  </View>
                </View>
              );
            })}

            {/* 判错时底部汇总提示 */}
            {hasSubmitted && !isCorrect && (
              <View style={styles.correctAnswerBox}>
                <Text style={styles.correctAnswerLabel}>正确释义：</Text>
                {currentWord.meanings.map((m, i) => (
                  <Text key={i} style={styles.correctAnswerText}>{i + 1}. {m}</Text>
                ))}
              </View>
            )}

            {/* AI 验证中转圈 */}
            {isVerifying && (
              <Text style={styles.verifyingText}>AI 判卷中...</Text>
            )}
          </View>

          {/* ── 底部按钮区 ── */}
          <View style={styles.footer}>
            {!hasSubmitted ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: inputs.some(i => i.trim()) ? '#0071E3' : '#94A3B8' }]}
                onPress={handleVerify}
                disabled={!inputs.some(i => i.trim())}
              >
                <Text style={styles.actionBtnText}>验证</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isCorrect ? '#34C759' : '#8E8E93' }]}
                onPress={handleNext}
              >
                <Text style={styles.actionBtnText}>下一题</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==========================================
// 样式表
// ==========================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
  centerRoot: { flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#86868B' },

  kav: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    elevation: 10,
    backgroundColor: '#F5F5F7',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
    paddingVertical: 4,
  },
  backBtnText: { fontSize: 16, fontWeight: '500', color: '#0071E3' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1D1D1F' },

  container: { flex: 1, justifyContent: 'space-between', padding: 24 },

  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 40,
  },
  wordTitle: { fontSize: 48, fontWeight: '800', color: '#1D1D1F', textAlign: 'center' },

  inputSection: { alignItems: 'center' },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  answerIndex: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    width: 24,
    textAlign: 'center',
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    width: '100%', height: 60, backgroundColor: '#FFFFFF', borderRadius: 16,
    fontSize: 20, textAlign: 'center', color: '#1D1D1F',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 2, borderColor: 'transparent',
  },
  inputCorrect: { borderColor: '#34C759' },
  inputWrong: { borderColor: '#FF3B30' },

  correctAnswerBox: {
    marginTop: 16,
    alignItems: 'center',
  },
  correctAnswerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  correctAnswerText: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },

  verifyingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },

  footer: { paddingBottom: 20 },
  actionBtn: {
    width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  gameOverContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 40 },
  gameOverTitle: { fontSize: 32, fontWeight: '800', color: '#1D1D1F', marginBottom: 24 },
  scoreText: { fontSize: 64, fontWeight: '900', color: '#0071E3', marginBottom: 40 },

  // ── 错词回顾 ──
  wrongSection: { width: '100%', marginBottom: 32 },
  wrongSectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1D1D1F', marginBottom: 16, textAlign: 'center',
  },
  wrongCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#F2F2F7',
  },
  wrongWordEnglish: {
    fontSize: 18, fontWeight: '700', color: '#1D1D1F', marginBottom: 6,
  },
  wrongUserAnswer: {
    fontSize: 14, fontWeight: '500', color: '#FF3B30', marginBottom: 2,
  },
  wrongCorrectAnswer: {
    fontSize: 14, fontWeight: '600', color: '#34C759',
  },
  perfectSection: { marginBottom: 40 },
  perfectText: { fontSize: 18, fontWeight: '600', color: '#34C759' },
  finishBtn: {
    backgroundColor: '#0071E3', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 24,
    shadowColor: '#0071E3', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  finishBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
});
