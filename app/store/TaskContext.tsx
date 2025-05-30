import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import supabase from '../services/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  user_id: string;
}

interface TaskContextType {
  tasks: Task[];
  loading: boolean;
  error: PostgrestError | null;
  addTask: (title: string, description?: string) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    fetchTasks();

    // Use polling instead of realtime to avoid WebSocket issues in React Native
    const pollInterval = setInterval(() => {
      fetchTasks();
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch tasks', error);
        setError(error);
      } else {
        logger.debug('Tasks fetched successfully', {
          context: { count: data.length },
        });
        setTasks(data);
        setError(null);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error fetching tasks', pgError);
      setError(pgError);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (title: string, description?: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title, description }])
        .select()
        .single();

      if (error) {
        logger.error('Failed to add task', error, {
          context: { title },
        });
        setError(error);
      } else {
        logger.info('Task added successfully', {
          context: {
            taskId: data.id,
            title,
          },
        });
        setTasks([data, ...tasks]);
        setError(null);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error adding task', pgError, {
        context: { title },
      });
      setError(pgError);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();

      if (error) {
        logger.error('Failed to update task', error, {
          context: { taskId: id },
        });
        setError(error);
      } else {
        logger.info('Task updated successfully', {
          context: {
            taskId: id,
            updates: Object.keys(updates),
          },
        });
        setTasks(tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)));
        setError(null);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error updating task', pgError, {
        context: { taskId: id },
      });
      setError(pgError);
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);

      if (error) {
        logger.error('Failed to delete task', error, {
          context: { taskId: id },
        });
        setError(error);
      } else {
        logger.info('Task deleted successfully', {
          context: { taskId: id },
        });
        setTasks(tasks.filter((task) => task.id !== id));
        setError(null);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error deleting task', pgError, {
        context: { taskId: id },
      });
      setError(pgError);
    }
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        error,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextType {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}

export default TaskProvider;
