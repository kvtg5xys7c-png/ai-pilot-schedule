import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playWord } from '../../src/services/audioService';

// ============================================================
// 类型定义
// ============================================================

interface Word {
  id: string;
  english: string;
  chinese: string;
  exampleEn?: string;
  exampleZh?: string;
}

// ============================================================
// 常量
// ============================================================

const PRELOAD_LOOKAHEAD = 5;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ============================================================
// AI 例句生成（纯函数，不涉及状态）
// ============================================================

async function fetchExampleFromAI(word: string): Promise<{ en: string; zh: string }> {
  const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY as string;
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个英语教材编写专家。请为用户提供的英文单词生成一个简短、地道的例句，以及准确的中文翻译。' +
            '严格按以下格式返回，不要有任何多余内容：' +
            '英文例句|||中文翻译' +
            '例句控制在15个单词以内，适合英语学习者理解。',
        },
        { role: 'user', content: word },
      ],
      temperature: 0.7,
      max_tokens: 120,
    }),
  });

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';
  const parts = content.split('|||').map((s: string) => s.trim());

  return {
    en: parts[0] || `This is an example with ${word}.`,
    zh: parts[1] || `这是一个包含"${word}"的例句。`,
  };
}

// ============================================================
// 主组件
// ============================================================

export default function ReviewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 用 ref 追踪正在请求中的单词 id，防止重复发起
  const inFlightIds = useRef<Set<string>>(new Set());
  // 用 ref 持有最新 words 引用，供闭包内读取而不触发 re-run
  const wordsRef = useRef<Word[]>([]);
  wordsRef.current = words;

  // ── 加载单词数据 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('memory_words');
        if (stored && !cancelled) {
          const allWords: Word[] = JSON.parse(stored);
          const chunked: Word[][] = [];
          for (let i = 0; i < allWords.length; i += 10) {
            chunked.push(allWords.slice(i, i + 10));
          }
          const targetIndex = Number(id) - 1;
          const loaded = chunked[targetIndex] ?? [];
          setWords(loaded);
        }
      } catch (e) {
        console.log('读取单词失败', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── 预加载流水线 ──
  const preloadNextExamples = useCallback((startIndex: number) => {
    const currentWords = wordsRef.current;
    const end = Math.min(startIndex + PRELOAD_LOOKAHEAD, currentWords.length);

    for (let i = startIndex; i < end; i++) {
      const word = currentWords[i];
      // 跳过已有例句或正在请求中的
      if (word.exampleEn || inFlightIds.current.has(word.id)) continue;

      inFlightIds.current.add(word.id);

      fetchExampleFromAI(word.english)
        .then(({ en, zh }) => {
          setWords(prev =>
            prev.map(w => (w.id === word.id ? { ...w, exampleEn: en, exampleZh: zh } : w))
          );
        })
        .catch(() => {
          // 失败时写入 fallback，避免下次重复请求
          setWords(prev =>
            prev.map(w =>
              w.id === word.id
                ? {
                    ...w,
                    exampleEn: `This is an example with ${word.english}.`,
                    exampleZh: `这是一个包含"${word.chinese}"的例句。`,
                  }
                : w
            )
          );
        })
        .finally(() => {
          inFlightIds.current.delete(word.id);
        });
    }
  }, []);

  // ── 首发触发：单词加载完毕后立即预载前 N 个 ──
  useEffect(() => {
    if (words.length > 0) {
      preloadNextExamples(0);
    }
  }, [words.length, preloadNextExamples]);

  // ── 滚动触发：切换索引时保持队列向下游推进 ──
  useEffect(() => {
    if (words.length > 0) {
      preloadNextExamples(currentIndex);
    }
  }, [currentIndex, preloadNextExamples]);

  // ── 导航逻辑 ──
  const handleBack = useCallback(() => {
    if (isFlipped) {
      setIsFlipped(false);
    } else {
      router.back();
    }
  }, [isFlipped, router]);

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleRate = (_level: string) => {
    handleNext();
  };

  // ── 加载态 ──
  if (isLoading) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>NO WORDS</Text>
        <TouchableOpacity style={styles.emptyBackBtn} onPress={() => router.back()}>
          <Text style={styles.emptyBackText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentWord = words[currentIndex];
  const exampleReady = !!currentWord.exampleEn;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 顶部导航 ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
        >
          <FontAwesome5 name="arrow-left" size={13} color="#000000" />
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{currentIndex + 1}/{words.length}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* ── 进度条 ── */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / words.length) * 100}%` },
          ]}
        />
      </View>

      {/* ── 核心卡片 ── */}
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.flashCard}
          activeOpacity={0.95}
          onPress={() => setIsFlipped(!isFlipped)}
        >
          {!isFlipped ? (
            /* ═══ 正面：单词 + 音标 + 喇叭 ═══ */
            <View style={styles.cardFront}>
              <Text style={styles.wordMain}>{currentWord.english}</Text>

              <View style={styles.phoneticRow}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => playWord(currentWord.english)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome5 name="volume-up" size={16} color="#8E8E93" />
                </TouchableOpacity>
                <Text style={styles.phoneticText}>/{currentWord.english}/</Text>
              </View>

              <View style={styles.flipHint}>
                <Text style={styles.flipHintText}>点击查看释义</Text>
              </View>
            </View>
          ) : (
            /* ═══ 背面：释义 + 例句 ═══ */
            <View style={styles.cardBack}>
              <View style={styles.backWordHeader}>
                <Text style={styles.backWord}>{currentWord.english}</Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => playWord(currentWord.english)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome5 name="volume-up" size={14} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* 词性 + 释义 */}
              <View style={styles.defSection}>
                <View style={styles.posTag}>
                  <Text style={styles.posText}>n.</Text>
                </View>
                <Text style={styles.defText}>{currentWord.chinese}</Text>
              </View>

              {/* 例句模块 */}
              <View style={styles.exampleBlock}>
                <View style={styles.exampleTag}>
                  <Text style={styles.exampleTagText}>例句</Text>
                </View>
                {exampleReady ? (
                  <>
                    <Text style={styles.exampleEnText}>{currentWord.exampleEn}</Text>
                    <Text style={styles.exampleZhText}>{currentWord.exampleZh}</Text>
                  </>
                ) : (
                  <View style={styles.loadingExample}>
                    <ActivityIndicator size="small" color="#8E8E93" />
                    <Text style={styles.loadingExampleText}>AI 正在全力加载中...</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── 底部操作栏 ── */}
      <View style={styles.footer}>
        {!isFlipped ? (
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={handlePrev}
              disabled={currentIndex === 0}
            >
              <FontAwesome5 name="chevron-left" size={12} color={currentIndex === 0 ? '#C7C7CC' : '#000'} />
              <Text style={[styles.navBtnText, currentIndex === 0 && { color: '#C7C7CC' }]}>上一个</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
              <Text style={styles.navBtnText}>下一个</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rateRow}>
            <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate('forgot')}>
              <FontAwesome5 name="times-circle" size={18} color="#FF3B30" />
              <Text style={[styles.rateBtnText, { color: '#FF3B30' }]}>不认识</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate('hard')}>
              <FontAwesome5 name="exclamation-circle" size={18} color="#FF9500" />
              <Text style={[styles.rateBtnText, { color: '#FF9500' }]}>生疏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate('good')}>
              <FontAwesome5 name="check-circle" size={18} color="#34C759" />
              <Text style={[styles.rateBtnText, { color: '#34C759' }]}>认识</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate('easy')}>
              <FontAwesome5 name="star" size={18} color="#0071E3" />
              <Text style={[styles.rateBtnText, { color: '#0071E3' }]}>简单</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 样式表 — 新粗野主义 (Neo-Brutalism)
// ============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 2,
  },
  emptyBackBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 2,
  },
  emptyBackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1,
  },

  // ── 顶部导航 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  progressBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  // ── 进度条 ──
  progressTrack: {
    height: 4,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000',
  },

  // ── 核心卡片 ──
  cardContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashCard: {
    width: '100%',
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000',
    padding: 28,
    justifyContent: 'center',
  },

  // ── 正面 ──
  cardFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordMain: {
    fontSize: 64,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    letterSpacing: -1,
  },
  phoneticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  phoneticText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  flipHint: {
    marginTop: 48,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 2,
  },
  flipHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C7C7CC',
    letterSpacing: 2,
  },

  // ── 背面 ──
  cardBack: {
    flex: 1,
    justifyContent: 'center',
  },
  backWordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  backWord: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginBottom: 20,
  },
  defSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 28,
  },
  posTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 6,
    backgroundColor: '#000',
  },
  posText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  defText: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    lineHeight: 30,
  },

  // ── 例句模块 ──
  exampleBlock: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 14,
  },
  exampleTag: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 6,
    marginBottom: 10,
  },
  exampleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  exampleEnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1D1D1F',
    lineHeight: 22,
    marginBottom: 6,
  },
  exampleZhText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    lineHeight: 20,
  },
  loadingExample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingExampleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // ── 底部操作栏 ──
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },

  // 翻页按钮行
  navRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  navBtnDisabled: {
    borderColor: '#E5E5EA',
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1.5,
  },

  // 评分按钮行
  rateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rateBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  rateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
