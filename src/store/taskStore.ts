// src/store/taskStore.ts
import { create } from 'zustand';
import { Task, TaskStatus } from '../types/task';
import { v4 as uuidv4 } from 'uuid';

interface TaskState {
tasks: Task[];
isLoading: boolean;
error: string | null;

addTask: (task: Omit<Task, 'id' | 'status'>) => string;
addTasks: (tasks: Omit<Task, 'id' | 'status'>[]) => void;
updateTaskStatus: (id: string, status: TaskStatus) => void;
updateTaskMeta: (id: string, meta: Partial<Task>) => void;
moveTaskToEnd: (id: string) => void;
deleteTask: (id: string) => void;
clearAllTasks: () => void;
getTaskById: (id: string) => Task | undefined;
getTasksByStatus: (status: TaskStatus) => Task[];
getPendingTasks: () => Task[];
setLoading: (loading: boolean) => void;
setError: (error: string | null) => void;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
tasks: [],
isLoading: false,
error: null,

addTask: (taskData) => {
const id = uuidv4();
const newTask: Task = {
...taskData,
id,
status: 'pending',
};
set((state) => ({ tasks: [...state.tasks, newTask] }));
return id;
},

addTasks: (tasksData) => {
const newTasks: Task[] = tasksData.map((taskData) => ({
...taskData,
id: uuidv4(),
status: 'pending' as TaskStatus,
}));
set((state) => ({ tasks: [...state.tasks, ...newTasks] }));
},

updateTaskStatus: (id, status) => {
set((state) => ({
tasks: state.tasks.map((task) =>
task.id === id ? { ...task, status } : task
),
}));
},

updateTaskMeta: (id, meta) => {
set((state) => ({
tasks: state.tasks.map((task) =>
task.id === id ? { ...task, ...meta } : task
),
}));
},

moveTaskToEnd: (id) => {
set((state) => {
const index = state.tasks.findIndex((task) => task.id === id);
if (index === -1) return state;
const task = state.tasks[index];
const newTasks = [...state.tasks];
newTasks.splice(index, 1);
newTasks.push(task);
return { tasks: newTasks };
});
},

deleteTask: (id) => {
set((state) => ({
tasks: state.tasks.filter((task) => task.id !== id),
}));
},

clearAllTasks: () => {
set({ tasks: [] });
},

getTaskById: (id) => {
return get().tasks.find((task) => task.id === id);
},

getTasksByStatus: (status) => {
return get().tasks.filter((task) => task.status === status);
},

getPendingTasks: () => {
return get().tasks.filter((task) => task.status === 'pending');
},

setLoading: (loading) => {
set({ isLoading: loading });
},

setError: (error) => {
set({ error });
},
}));

