import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  React.useEffect(() => {
    SplashScreen.hideAsync();
    // --- 艾宾浩斯引擎测试探针 ---
    const dummyTask = {
      id: "408_01",
      title: "数据结构：线性表必背内容",
      type: "learn",
      level: "hard",
      lastStudyDate: new Date().toISOString(),
      reviewStage: 0
    };

    console.log("=== 测试开始 ===");
    console.log("当前任务状态：", dummyTask);
    console.log("=== 测试结束 ===");
    // -------------------------
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
