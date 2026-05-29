import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 注意路径，根据你实际的文件层级可能需要改成 '../src/services/aiService' 等
import { verifyAnswerWithAI } from '../../src/services/aiService';
import { playWord } from '../../src/services/audioService';


interface Word {
  id: string;
  english: string;
  chinese: string;
}

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams();
  const [levelWords, setLevelWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 测验状态
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [inputText, setInputText] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadWords();
  }, [id]);

  // 1. 真实读取本地数据库
  const loadWords = async () => {
    try {
      const stored = await AsyncStorage.getItem('memory_words');
      if (stored) {
        const allWords: Word[] = JSON.parse(stored);
        const chunked = [];
        for (let i = 0; i < allWords.length; i += 10) {
          chunked.push(allWords.slice(i, i + 10));
        }
        const targetIndex = Number(id) - 1;
        if (chunked[targetIndex]) {
          setLevelWords(chunked[targetIndex]);
        }
      }
    } catch (e) {
      console.log('读取单词失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 验证与宽容匹配逻辑
  const handleVerify = async () => {
    const currentWord = levelWords[currentIndex];
    const userAnswer = inputText.trim();
    
    if (!userAnswer) return;

    // 第一关：本地秒判（防止浪费 API）
    const isLocalCorrect = currentWord.chinese.includes(userAnswer) || userAnswer.includes(currentWord.chinese);
    
    if (isLocalCorrect) {
      setIsCorrect(true);
      setScore(score + 1);
      setHasSubmitted(true);
      Keyboard.dismiss();
      return; // 提前结束，不呼叫 AI
    }

    // 第二关：本地判错了，呼叫 AI 老师来救场
    setIsVerifying(true); // 开启转圈圈
    const isAiCorrect = await verifyAnswerWithAI(currentWord.english, currentWord.chinese, userAnswer);
    setIsVerifying(false); // 关闭转圈圈

    setIsCorrect(isAiCorrect);
    if (isAiCorrect) setScore(score + 1);
    
    setHasSubmitted(true);
    Keyboard.dismiss();
  };

  // 3. 进入下一题或结算
  const handleNext = () => {
    if (currentIndex < levelWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setInputText('');
      setHasSubmitted(false);
      setIsCorrect(false);
    } else {
      setIsGameOver(true);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>加载题目中...</Text>
      </View>
    );
  }

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

  // ===== 结算页面 =====
  if (isGameOver) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>挑战完成！</Text>
          <Text style={styles.scoreText}>{score} / {levelWords.length}</Text>
          
          <TouchableOpacity style={styles.finishBtn} onPress={() => router.back()}>
            <Text style={styles.finishBtnText}>返回天梯</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ===== 答题页面 =====
  const currentWord = levelWords[currentIndex];

  return (
    <SafeAreaView style={styles.root}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="chevron-left" size={16} color="#0071E3" />
          <Text style={styles.backBtnText}>放弃</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentIndex + 1} / {levelWords.length}</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          <TextInput
            style={[
              styles.input,
              hasSubmitted && isCorrect && styles.inputCorrect,
              hasSubmitted && !isCorrect && styles.inputWrong,
            ]}
            placeholder="请输入中文释义..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            editable={!hasSubmitted} // 验证后不可再编辑
            autoFocus={true}
            onSubmitEditing={hasSubmitted ? handleNext : handleVerify} // 按下回车键自动验证或下一步
          />
          
          {/* 答错时显示正确答案 */}
          {hasSubmitted && !isCorrect && (
            <Text style={styles.correctAnswerText}>标准答案：{currentWord.chinese}</Text>
          )}
        </View>

        {/* 底部按钮区 */}
        <View style={styles.footer}>
          {!hasSubmitted ? (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: inputText.trim() ? '#0071E3' : '#94A3B8' }]} 
              onPress={handleVerify}
              disabled={!inputText.trim()}
            >
              <Text style={styles.actionBtnText}>验证</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#34C759' }]} 
              onPress={handleNext}
            >
              <Text style={styles.actionBtnText}>下一题</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
  centerRoot: { flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#86868B' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
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
  input: {
    width: '100%', height: 60, backgroundColor: '#FFFFFF', borderRadius: 16,
    fontSize: 20, textAlign: 'center', color: '#1D1D1F',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 2, borderColor: 'transparent',
  },
  inputCorrect: { borderColor: '#34C759' },
  inputWrong: { borderColor: '#FF3B30' },
  correctAnswerText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#34C759' },

  footer: { paddingBottom: 20 },
  actionBtn: {
    width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  gameOverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  gameOverTitle: { fontSize: 32, fontWeight: '800', color: '#1D1D1F', marginBottom: 24 },
  scoreText: { fontSize: 64, fontWeight: '900', color: '#0071E3', marginBottom: 60 },
  finishBtn: {
    backgroundColor: '#0071E3', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 24,
    shadowColor: '#0071E3', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  finishBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
});