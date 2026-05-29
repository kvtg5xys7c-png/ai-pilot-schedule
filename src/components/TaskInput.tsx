// src/components/TaskInput.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { TaskInput as TaskInputType } from '../types/task';

interface TaskInputProps {
  onSubmit: (input: TaskInputType) => Promise<void>;
  isLoading?: boolean;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onSubmit, isLoading }) => {
  const [goal, setGoal] = useState('');
  const [availableTime, setAvailableTime] = useState('');

  const handleSubmit = async () => {
    if (!goal.trim()) {
      Alert.alert('提示', '请输入你的目标');
      return;
    }

    await onSubmit({
      userGoal: goal.trim(),
      availableTime: availableTime.trim() || '今天全天',
    });

    setGoal('');
    setAvailableTime('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>目标</Text>
      <TextInput
        style={styles.input}
        value={goal}
        onChangeText={setGoal}
        placeholder="请输入你的目标"
        placeholderTextColor="#A0A0A0"
        multiline
      />
      <Text style={styles.label}>可用时间</Text>
      <TextInput
        style={styles.input}
        value={availableTime}
        onChangeText={setAvailableTime}
        placeholder="例如：今天全天、2小时等"
        placeholderTextColor="#A0A0A0"
        multiline
      />
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>生成计划</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
    minHeight: 56,
  },
  button: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
    borderColor: '#A0A0A0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
