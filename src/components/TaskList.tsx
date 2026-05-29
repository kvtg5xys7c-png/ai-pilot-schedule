// src/components/TaskList.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Task } from '../types/task';
import { TaskCard } from './TaskCard';
import { getRelativeDateLabel } from '../utils/dateUtils';

interface TaskListProps {
  tasks: Task[];
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTaskPress?: (task: Task) => void;
  emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onComplete,
  onDelete,
  onTaskPress,
  emptyMessage = '暂无任务',
}) => {
  // 按日期分组
  const groupedTasks = tasks.reduce((groups, task) => {
    const dateKey = getRelativeDateLabel(task.startTime);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(task);
    return groups;
  }, {} as Record<string, Task[]>);

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => {
    if (a === '今天') return -1;
    if (b === '今天') return 1;
    if (a === '明天') return -1;
    if (b === '明天') return 1;
    return 0;
  });

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sortedDates}
      keyExtractor={(date) => date}
      renderItem={({ item: date }) => (
        <View style={styles.dateGroup}>
          <Text style={styles.dateHeader}>{date}</Text>
          <FlatList
            data={groupedTasks[date]}
            keyExtractor={(task) => task.id}
            renderItem={({ item: task }) => (
              <TaskCard
                task={task}
                onComplete={onComplete}
                onDelete={onDelete}
                onPress={onTaskPress}
              />
            )}
          />
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});