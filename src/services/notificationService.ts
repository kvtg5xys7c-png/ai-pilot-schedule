// src/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../types/task';

// 配置通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
* 请求通知权限
*/
export const requestNotificationPermissions = async (): Promise<boolean> => {
const { status: existingStatus } = await Notifications.getPermissionsAsync();

let finalStatus = existingStatus;

if (existingStatus !== 'granted') {
const { status } = await Notifications.requestPermissionsAsync();
finalStatus = status;
}

if (finalStatus !== 'granted') {
console.log('通知权限未授予');
return false;
}

if (Platform.OS === 'android') {
await Notifications.setNotificationChannelAsync('task-reminders', {
name: '任务提醒',
importance: Notifications.AndroidImportance.HIGH,
vibrationPattern: [0, 250, 250, 250],
lightColor: '#FF231F7C',
});
}

return true;
};

/**
* 为任务调度通知
*/
export const scheduleTaskNotification = async (
task: Task,
minutesBefore: number = 10
): Promise<string | null> => {
try {
const notificationTime = new Date(task.startTime);
notificationTime.setMinutes(notificationTime.getMinutes() - minutesBefore);

// 如果通知时间已过，不调度
if (notificationTime <= new Date()) {
console.log(`任务 "${task.title}" 的通知时间已过`);
return null;
}

const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ 即将开始: ${task.title}`,
        body: task.aiMessage || `距离开始还有 ${minutesBefore} 分钟`,
        data: { taskId: task.id },
        sound: true,
        // 删除了原本冗长的 priority，最新版默认由 channel 控制优先级
      },
      trigger: {
        // 删除了 type 属性，Expo 看到 date 会自动识别
        date: notificationTime,
        channelId: 'task-reminders',
      },
    });

return notificationId;
} catch (error) {
console.error('调度通知失败:', error);
return null;
}
};

/**
* 取消任务通知
*/
export const cancelTaskNotification = async (notificationId: string): Promise<void> => {
await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
* 取消所有通知
*/
export const cancelAllNotifications = async (): Promise<void> => {
await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
* 获取所有待发送的通知
*/
export const getAllScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
return await Notifications.getAllScheduledNotificationsAsync();
};

/**
* 为任务列表批量调度通知
*/
export const scheduleNotificationsForTasks = async (
tasks: Task[],
reminderMinutes: number[] = [10, 30] // 提前 10 分钟和 30 分钟提醒
): Promise<Map<string, string[]>> => {
const notificationMap = new Map();

for (const task of tasks) {
const notificationIds: string[] = [];

for (const minutes of reminderMinutes) {
const id = await scheduleTaskNotification(task, minutes);
if (id) {
notificationIds.push(id);
}
}

if (notificationIds.length > 0) {
notificationMap.set(task.id, notificationIds);
}
}

return notificationMap;
};
