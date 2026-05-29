// src/components/TaskCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task, TaskStatus } from '../types/task';
import { formatTime, formatDuration, getDurationInMinutes } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPress?: (task: Task) => void;
}

const statusColors: Record<TaskStatus, string> = {
  pending: '#3B82F6',
  completed: '#10B981',
  missed: '#EF4444',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: '待完成',
  completed: '已完成',
  missed: '已错过',
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onDelete,
  onPress,
}) => {
  const duration = getDurationInMinutes(task.startTime, task.endTime);
  const statusColor = statusColors[task.status] ?? '#6B7280';
  const statusLabel = statusLabels[task.status] ?? task.status;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: statusColor }]}
      onPress={() => onPress?.(task)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}> 
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(task.startTime)} - {formatTime(task.endTime)}
        </Text>
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>

      {task.aiMessage ? <Text style={styles.aiMessage}>{task.aiMessage}</Text> : null}

      <View style={styles.actions}>
        {task.status !== 'completed' && onComplete ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.completeBtn]}
            onPress={() => onComplete(task.id)}
          >
            <Text style={styles.actionBtnText}>完成</Text>
          </TouchableOpacity>
        ) : null}

        {onDelete ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => onDelete(task.id)}
          >
            <Text style={styles.actionBtnText}>删除</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  durationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  aiMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  completeBtn: {
    backgroundColor: '#10B981',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});