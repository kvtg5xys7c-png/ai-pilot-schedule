import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ============================================================
// 选项卡片数据
// ============================================================

interface DeckOption {
  id: string;
  title: string;
  desc: string;
  emoji: string;
}

const DECK_OPTIONS: DeckOption[] = [
  {
    id: 'ai',
    title: 'AI 智造词集',
    desc: '输入主题，AI 自动生成考研/408 专属词库',
    emoji: '🤖',
  },
  {
    id: 'manual',
    title: '手动逐词录入',
    desc: '一个个手动添加，适合精挑细选的学霸',
    emoji: '✍️',
  },
  {
    id: 'import',
    title: '批量导入词库',
    desc: '从 CSV / TXT 文件一键导入海量词汇',
    emoji: '📦',
  },
];

// ============================================================
// 主组件
// ============================================================

export default function NewDeckScreen() {
  const router = useRouter();

  const [deckName, setDeckName] = useState('');
  const [levelCount, setLevelCount] = useState(3);
  const [selectedOption, setSelectedOption] = useState('ai');

  const handleDecrement = () => {
    if (levelCount > 1) setLevelCount(levelCount - 1);
  };

  const handleIncrement = () => {
    if (levelCount < 20) setLevelCount(levelCount + 1);
  };

  const handleCreate = (andChallenge: boolean) => {
    if (!deckName.trim()) {
      Alert.alert('提示', '请输入卡片集名称');
      return;
    }
    Alert.alert('成功', `卡片集「${deckName}」已创建！`);
    if (andChallenge) {
      router.push('/memory' as any);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 顶部导航 ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={13} color="#000" />
          <Text style={s.backBtnText}>返回</Text>
        </TouchableOpacity>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 标题区 ── */}
        <View style={s.titleSection}>
          <Text style={s.pageTitle}>新建卡片集</Text>
          <Text style={s.pageSubtitle}>在这里您可以新建一组专属记忆卡片</Text>
        </View>

        {/* ── 卡片集名称输入 ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>卡片集名称</Text>
          <TextInput
            style={s.nameInput}
            placeholder="例如：考研英语核心词汇"
            placeholderTextColor="#A0A0A0"
            value={deckName}
            onChangeText={setDeckName}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* ── 关卡数 Stepper ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>关卡数</Text>
          <View style={s.stepperContainer}>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={handleDecrement}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="minus" size={14} color="#000" />
            </TouchableOpacity>

            <View style={s.stepperValue}>
              <Text style={s.stepperNumber}>{levelCount}</Text>
              <Text style={s.stepperUnit}>关</Text>
            </View>

            <TouchableOpacity
              style={s.stepperBtn}
              onPress={handleIncrement}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="plus" size={14} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={s.fieldHint}>每关 10 个单词，共 {levelCount * 10} 词</Text>
        </View>

        {/* ── 创建方式选项卡 ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>创建方式</Text>

          {DECK_OPTIONS.map((option) => {
            const isSelected = selectedOption === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[s.optionCard, isSelected && s.optionCardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedOption(option.id)}
              >
                <View style={s.optionLeft}>
                  <Text style={s.optionEmoji}>{option.emoji}</Text>
                  <View style={s.optionTextWrap}>
                    <Text style={s.optionTitle}>{option.title}</Text>
                    <Text style={s.optionDesc}>{option.desc}</Text>
                  </View>
                </View>

                <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
                  {isSelected && <View style={s.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ── 底部操作按钮 ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.challengeBtn}
          activeOpacity={0.8}
          onPress={() => handleCreate(true)}
        >
          <FontAwesome5 name="bolt" size={14} color="#FFF" />
          <Text style={s.challengeBtnText}>新建并挑战</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.createBtn}
          activeOpacity={0.8}
          onPress={() => handleCreate(false)}
        >
          <FontAwesome5 name="plus" size={14} color="#000" />
          <Text style={s.createBtnText}>新建</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 样式表 — 新粗野主义 (Neo-Brutalism)
// ============================================================

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
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
    marginTop: 16,
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -1,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 6,
  },

  // ── 字段组 ──
  fieldGroup: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#C7C7CC',
    marginTop: 8,
  },

  // ── 名称输入框 ──
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // ── Stepper ──
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    gap: 2,
  },
  stepperNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    fontVariant: ['tabular-nums'],
  },
  stepperUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // ── 选项卡片 ──
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: '#000',
    borderWidth: 2,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  optionEmoji: {
    fontSize: 36,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginBottom: 3,
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    lineHeight: 18,
  },

  // ── 单选按钮 ──
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioOuterSelected: {
    borderColor: '#000',
    backgroundColor: '#FFFFFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
  },

  // ── 底部按钮 ──
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 12,
  },
  challengeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  challengeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
});
