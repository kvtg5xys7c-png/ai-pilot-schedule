import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// 本地存储 Key
// ============================================================

const CAMP_STORAGE_KEY = 'gugugaga_camp_playlist';

// ============================================================
// 类型 & 工具
// ============================================================

interface TapeEntry {
  id: string;
  name: string;
  uri: string;
}

function generateTapeId(): string {
  return `tape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================
// 主屏幕
// ============================================================

export default function CampScreen() {
  const router = useRouter();

  // ── 播放列表状态 ──
  const [playlist, setPlaylist] = useState<TapeEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── 播放列表 Ref（解决闭包陈旧，loadAndPlayTrack 始终拿到最新歌单） ──
  const playlistRef = useRef<TapeEntry[]>([]);

  // ── 初始化哨兵（防止首次空数组保存覆盖已持久化的歌单） ──
  const hasInitializedRef = useRef(false);

  // ── Audio.Sound 引用（不放入 state，避免序列化问题） ──
  const soundRef = useRef<Audio.Sound | null>(null);
  const isSwitchingRef = useRef(false);

  // ── 声场光环旋转 ──
  const ringRotate = useRef(new Animated.Value(0)).current;
  const ringLoop = useRef<Animated.CompositeAnimation | null>(null);

  const startBreathing = useCallback(() => {
    ringLoop.current = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    ringLoop.current.start();
  }, [ringRotate]);

  const stopBreathing = useCallback(() => {
    if (ringLoop.current) {
      ringLoop.current.stop();
      ringLoop.current = null;
    }
  }, []);

  // ==========================================================
  // 持久化 ①：初始化时从本地存储恢复歌单
  // ==========================================================
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(CAMP_STORAGE_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPlaylist(parsed);
            }
          } catch {
            // 存储数据损坏，忽略并使用空列表
          }
        }
        hasInitializedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          hasInitializedRef.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ==========================================================
  // 持久化 ②：playlist 变化时自动序列化保存
  // ==========================================================
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (playlist.length > 0) {
      AsyncStorage.setItem(CAMP_STORAGE_KEY, JSON.stringify(playlist)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CAMP_STORAGE_KEY).catch(() => {});
    }
  }, [playlist]);

  // ==========================================================
  // 同步 playlist → ref（使 loadAndPlayTrack 不受闭包陈旧影响）
  // ==========================================================
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // ==========================================================
  // 资源清理（⚠️ 仅停止音频与动画，绝不触碰 playlist）
  // ==========================================================
  useEffect(() => {
    return () => {
      if (ringLoop.current) {
        ringLoop.current.stop();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      // 歌单已通过 AsyncStorage 持久化，此处绝不清空
    };
  }, []);

  // ==========================================================
  // 核心：加载并播放指定索引的曲目
  // ==========================================================
  const loadAndPlayTrack = useCallback(
    async (index: number, autoPlay: boolean) => {
      const currentPlaylist = playlistRef.current;
      if (index < 0 || index >= currentPlaylist.length) return;

      isSwitchingRef.current = true;

      // 卸载上一首
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      const tape = currentPlaylist[index];

      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: tape.uri },
          { shouldPlay: false },
        );

        soundRef.current = newSound;
        setCurrentIndex(index);

        // 监听播放状态（依赖 currentPlaylist 快照，不受后续 Render 影响）
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          // 自然播放完毕 → 自动下一首
          if (status.didJustFinish) {
            if (isSwitchingRef.current) {
              isSwitchingRef.current = false;
              return;
            }
            const nextIndex = index + 1 >= currentPlaylist.length ? 0 : index + 1;
            setTimeout(() => {
              loadAndPlayTrack(nextIndex, true);
            }, 100);
            return;
          }
        });

        if (autoPlay) {
          await newSound.playAsync();
          setIsPlaying(true);
          startBreathing();
        } else {
          setIsPlaying(false);
          stopBreathing();
        }
      } catch {
        Alert.alert('加载失败', '无法解析该音频文件。');
      } finally {
        isSwitchingRef.current = false;
      }
    },
    [startBreathing, stopBreathing],
  );

  // ==========================================================
  // 选择音频文件 → 追加到队列
  // ==========================================================
  const handlePickAudio = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      const newTape: TapeEntry = {
        id: generateTapeId(),
        name: file.name ?? '未知音频',
        uri: file.uri,
      };

      setPlaylist((prev) => {
        const updated = [...prev, newTape];
        if (prev.length === 0) {
          // 此前队列为空 → 延迟到状态落库后自动播放第一首
          setTimeout(() => loadAndPlayTrack(0, true), 50);
        }
        return updated;
      });
    } catch (err: any) {
      Alert.alert('载入失败', err?.message ?? '无法读取音频文件，请重试。');
    }
  }, [loadAndPlayTrack]);

  // ==========================================================
  // 播放 / 暂停
  // ==========================================================
  const handleTogglePlayback = useCallback(async () => {
    const s = soundRef.current;
    if (!s) {
      Alert.alert('未载入音频', '请先选择一段音频文件。');
      return;
    }

    try {
      const status = await s.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
        stopBreathing();
      } else {
        await s.playAsync();
        setIsPlaying(true);
        startBreathing();
      }
    } catch {
      Alert.alert('播放异常', '音频播放出错，请尝试重新载入文件。');
    }
  }, [startBreathing, stopBreathing]);

  // ==========================================================
  // 上一首
  // ==========================================================
  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
    loadAndPlayTrack(nextIndex, isPlaying);
  }, [playlist.length, currentIndex, isPlaying, loadAndPlayTrack]);

  // ==========================================================
  // 下一首
  // ==========================================================
  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = currentIndex + 1 >= playlist.length ? 0 : currentIndex + 1;
    loadAndPlayTrack(nextIndex, isPlaying);
  }, [playlist.length, currentIndex, isPlaying, loadAndPlayTrack]);

  // ==========================================================
  // 点击列表项切歌
  // ==========================================================
  const handleSelectTrack = useCallback(
    (index: number) => {
      if (index === currentIndex) return;
      loadAndPlayTrack(index, true);
    },
    [currentIndex, loadAndPlayTrack],
  );

  // ==========================================================
  // 删除磁带（底层执行逻辑）
  // ==========================================================
  const handleDeleteTape = useCallback(
    (id: string, index: number) => {
      // 若删除的是当前正在播放的曲目 → 停止播放并销毁音频实例
      if (index === currentIndex) {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        setIsPlaying(false);
        stopBreathing();
      }

      // 从数组中过滤移除
      setPlaylist((prev) => prev.filter((t) => t.id !== id));

      // 校正 currentIndex
      if (index === currentIndex) {
        setCurrentIndex(-1);
      } else if (index < currentIndex) {
        setCurrentIndex((prev) => prev - 1);
      }
    },
    [currentIndex, stopBreathing],
  );

  // ==========================================
  // 删除磁带 (防误触确认弹窗 - Web/移动端双端兼容)
  // ==========================================
  const confirmDelete = useCallback(
    (id: string, index: number, name: string) => {
      if (Platform.OS === 'web') {
        const isConfirmed = window.confirm(
          `销毁音频：\n\n确定要将 [${name}] 从营地中永久丢弃吗？`,
        );
        if (isConfirmed) {
          handleDeleteTape(id, index);
        }
      } else {
        Alert.alert('销毁音频', `确定要将 [${name}] 从营地中永久丢弃吗？`, [
          { text: '取消', style: 'cancel' },
          {
            text: '确认销毁',
            style: 'destructive',
            onPress: () => handleDeleteTape(id, index),
          },
        ]);
      }
    },
    [handleDeleteTape],
  );

  // ── 当前曲目名称 ──
  const currentTrackName =
    currentIndex >= 0 && currentIndex < playlist.length
      ? playlist[currentIndex].name
      : null;

  // ── 旋转插值 ──
  const ringSpin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ==========================================================
  // 渲染
  // ==========================================================

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 顶部导航栏 ── */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
        >
          <Feather name="arrow-left" size={18} color="black" />
          <Text style={styles.backBtnText}>返回大门</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>休整营地</Text>
        <View style={styles.navSpacer} />
      </View>

      {/* ── 主体内容 ── */}
      <View style={styles.body}>
        {/* ═══════════════════════════════════════════════ */}
        {/*  声场光球 — 中央视觉核心                         */}
        {/* ═══════════════════════════════════════════════ */}
        <View style={styles.soundFieldContainer}>
          {/* 旋转光环 */}
          <Animated.View
            style={[
              styles.soundFieldRing,
              { transform: [{ rotate: ringSpin }] },
            ]}
          >
            <View style={styles.ringDot} />
            <View style={[styles.ringDot, styles.ringDotOpposite]} />
          </Animated.View>

          {/* 中心玻璃态卡片 */}
          <View style={styles.soundFieldCore}>
            <View style={styles.soundFieldCoreInner}>
              <FontAwesome5
                name={isPlaying ? 'broadcast-tower' : 'headphones-alt'}
                size={36}
                color="#000000"
                solid
              />
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════ */}
        {/*  曲目名称                                      */}
        {/* ═══════════════════════════════════════════════ */}
        <Text
          style={[
            styles.trackTitle,
            currentTrackName && styles.trackTitleActive,
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {currentTrackName ?? '未在播放'}
        </Text>

        {/* ═══════════════════════════════════════════════ */}
        {/*  曲目状态标识                                   */}
        {/* ═══════════════════════════════════════════════ */}
        <View style={styles.trackBadge}>
          <View
            style={[
              styles.trackDot,
              playlist.length > 0 && styles.trackDotLive,
            ]}
          />
          <Text style={styles.trackLabel}>
            {playlist.length === 0
              ? '队列空'
              : `${currentIndex + 1} / ${playlist.length}`}
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════ */}
        {/*  播放控制区 — 亮色毛玻璃胶囊                     */}
        {/* ═══════════════════════════════════════════════ */}
        <View style={styles.dockGlass}>
          {/* 进度条 */}
          <View style={styles.progressRow}>
            <Text style={styles.progressTime}>00:00</Text>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressTime}>00:00</Text>
          </View>

          {/* 导航行 */}
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={styles.transportBtn}
              activeOpacity={0.6}
              onPress={handlePrev}
              disabled={playlist.length === 0}
            >
              <FontAwesome5
                name="step-backward"
                size={18}
                color={playlist.length === 0 ? 'rgba(0,0,0,0.15)' : '#000000'}
                solid
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playBtn,
                playlist.length === 0 && styles.playBtnDisabled,
              ]}
              activeOpacity={0.7}
              onPress={handleTogglePlayback}
              disabled={playlist.length === 0}
            >
              <FontAwesome5
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color={playlist.length === 0 ? 'rgba(0,0,0,0.15)' : '#000000'}
                solid
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.transportBtn}
              activeOpacity={0.6}
              onPress={handleNext}
              disabled={playlist.length === 0}
            >
              <FontAwesome5
                name="step-forward"
                size={18}
                color={playlist.length === 0 ? 'rgba(0,0,0,0.15)' : '#000000'}
                solid
              />
            </TouchableOpacity>
          </View>

          {/* 载入音频 */}
          <TouchableOpacity
            style={styles.loadBtn}
            activeOpacity={0.7}
            onPress={handlePickAudio}
          >
            <FontAwesome5 name="plus" size={11} color="rgba(0,0,0,0.4)" solid />
            <Text style={styles.loadBtnText}>载入音频</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════ */}
        {/*  播放列表 — 亮色毛玻璃容器                       */}
        {/* ═══════════════════════════════════════════════ */}
        <View style={styles.playlistGlass}>
          <View style={styles.playlistHeader}>
            <FontAwesome5 name="list-ul" size={12} color="rgba(0,0,0,0.35)" solid />
            <Text style={styles.playlistHeaderText}>
              播放列表 · {playlist.length} 首
            </Text>
          </View>

          {playlist.length === 0 ? (
            <View style={styles.playlistEmpty}>
              <FontAwesome5 name="music" size={24} color="rgba(0,0,0,0.12)" solid />
              <Text style={styles.playlistEmptyText}>
                暂无音频，请点击上方按钮载入
              </Text>
            </View>
          ) : (
            <FlatList
              data={playlist}
              keyExtractor={(item) => item.id}
              style={styles.playlistList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const isActive = index === currentIndex;
                return (
                  <TouchableOpacity
                    style={[
                      styles.playlistItem,
                      isActive && styles.playlistItemActive,
                    ]}
                    activeOpacity={0.6}
                    onPress={() => handleSelectTrack(index)}
                  >
                    <View style={styles.playlistItemRow}>
                      <View style={styles.playlistItemContent}>
                        <View style={styles.playlistItemLeft}>
                          {isActive && isPlaying ? (
                            <View style={styles.playingBars}>
                              <View style={styles.playingBar} />
                              <View
                                style={[
                                  styles.playingBar,
                                  styles.playingBarShort,
                                ]}
                              />
                              <View style={styles.playingBar} />
                            </View>
                          ) : isActive ? (
                            <FontAwesome5
                              name="pause"
                              size={10}
                              color="#000000"
                              solid
                            />
                          ) : (
                            <Text style={styles.playlistIndex}>
                              {String(index + 1).padStart(2, '0')}
                            </Text>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.playlistItemName,
                            isActive && styles.playlistItemNameActive,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.name}
                        </Text>
                      </View>

                      <View style={styles.playlistItemRight}>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          activeOpacity={0.5}
                          onPress={() =>
                            confirmDelete(item.id, index, item.name)
                          }
                        >
                          <FontAwesome5
                            name="trash-alt"
                            size={12}
                            color="rgba(204,68,68,0.7)"
                            solid
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 样式表 — 亮色纯净风格
// ============================================================

const styles = StyleSheet.create({
  // ── 根容器 ──
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── 顶部导航 ──
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.5,
  },
  navSpacer: {
    width: 70,
  },

  // ── 主体 ──
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // ═══════════════════════════════════════════════
  // 声场光球
  // ═══════════════════════════════════════════════
  soundFieldContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  soundFieldRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  ringDot: {
    position: 'absolute',
    top: -3,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  ringDotOpposite: {
    top: 'auto',
    bottom: -3,
    left: '50%',
  },
  soundFieldCore: {
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundFieldCoreInner: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 曲目标题 ──
  trackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.2)',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 24,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  trackTitleActive: {
    color: '#000000',
  },

  // ── 曲目标识 ──
  trackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  trackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  trackDotLive: {
    backgroundColor: '#34C759',
  },
  trackLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 0.5,
  },

  // ═══════════════════════════════════════════════
  // 播放控制 — 亮色毛玻璃胶囊
  // ═══════════════════════════════════════════════
  dockGlass: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },

  // 进度条
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  progressTime: {
    fontSize: 10,
    color: '#666666',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 1,
  },
  progressFill: {
    width: '0%',
    height: 2,
    backgroundColor: '#000000',
    borderRadius: 1,
  },

  // 导航行
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  transportBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 播放按钮 — 线框圆环
  playBtn: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  playBtnDisabled: {
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },

  // 载入按钮
  loadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  loadBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.5)',
    letterSpacing: 0.3,
  },

  // ═══════════════════════════════════════════════
  // 播放列表 — 亮色毛玻璃容器
  // ═══════════════════════════════════════════════
  playlistGlass: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  playlistHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 0.5,
  },
  playlistEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  playlistEmptyText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.25)',
  },
  playlistList: {
    flex: 1,
  },

  // 列表项
  playlistItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  playlistItemActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },

  playlistItemRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playlistItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playlistItemLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistIndex: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.25)',
    letterSpacing: 0.5,
  },
  playlistItemName: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(0,0,0,0.55)',
    fontWeight: '400',
  },
  playlistItemNameActive: {
    color: '#000000',
    fontWeight: '600',
  },

  // 播放中动画条
  playingBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 12,
  },
  playingBar: {
    width: 2.5,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 1,
  },
  playingBarShort: {
    height: 6,
  },

  playlistItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
});
