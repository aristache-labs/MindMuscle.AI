import { PostgrestError } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { logger } from '../utils/logger';
import supabase from '../services/supabase';

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

  // Set user context for Sentry
  useEffect(() => {
    const getUserId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
        });

        Sentry.setTag('user_authenticated', 'true');
        Sentry.addBreadcrumb({
          message: 'User authenticated for task management',
          category: 'auth',
          level: 'info',
          data: { user_id: user.id },
        });
      }
    };

    getUserId();
  }, []);

  useEffect(() => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskProvider.initialization',
      op: 'task.context.init',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'TaskProvider initialized',
        category: 'task.context',
        level: 'info',
      });

      fetchTasks();

      // Use polling instead of realtime to avoid WebSocket issues in React Native
      const pollInterval = setInterval(() => {
        Sentry.addBreadcrumb({
          message: 'Task polling triggered',
          category: 'task.polling',
          level: 'debug',
        });
        fetchTasks();
      }, 30000); // Poll every 30 seconds

      span.setStatus({ code: 2 }); // OK
      return () => {
        clearInterval(pollInterval);
        Sentry.addBreadcrumb({
          message: 'TaskProvider cleanup',
          category: 'task.context',
          level: 'info',
        });
      };
    } catch (error) {
      span.setStatus({ code: 1, message: 'Initialization failed' });
      Sentry.captureException(error, {
        tags: { operation: 'task_provider_init' },
        extra: { component: 'TaskProvider' },
      });
      throw error;
    } finally {
      span.end();
    }
  }, []);

  const fetchTasks = async () => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskContext.fetchTasks',
      op: 'db.query',
    });

    try {
      setLoading(true);

      Sentry.addBreadcrumb({
        message: 'Fetching tasks from database',
        category: 'task.fetch',
        level: 'info',
      });

      const startTime = Date.now();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      const duration = Date.now() - startTime;

      Sentry.setMeasurement('task_fetch_duration_ms', duration, 'millisecond');

      if (error) {
        logger.error('Failed to fetch tasks', error as Error);
        setError(error);

        Sentry.captureException(error, {
          tags: {
            operation: 'fetch_tasks',
            error_code: error.code || 'unknown',
          },
          extra: {
            error_details: error.details,
            error_hint: error.hint,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 1, message: 'Database error' });
      } else {
        logger.debug('Tasks fetched successfully', {
          context: { count: data.length },
        });

        setTasks(data);
        setError(null);

        Sentry.addBreadcrumb({
          message: 'Tasks fetched successfully',
          category: 'task.fetch',
          level: 'info',
          data: {
            count: data.length,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 2 }); // OK
        span.setAttribute('task_count', data.length);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error fetching tasks', pgError);
      setError(pgError);

      Sentry.captureException(pgError, {
        tags: { operation: 'fetch_tasks_unexpected' },
        extra: { component: 'TaskContext' },
      });

      span.setStatus({ code: 1, message: 'Unexpected error' });
    } finally {
      setLoading(false);
      span.end();
    }
  };

  const addTask = async (title: string, description?: string) => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskContext.addTask',
      op: 'db.insert',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'Adding new task',
        category: 'task.create',
        level: 'info',
        data: { title, has_description: !!description },
      });

      const startTime = Date.now();
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title, description }])
        .select()
        .single();

      const duration = Date.now() - startTime;
      Sentry.setMeasurement('task_add_duration_ms', duration, 'millisecond');

      if (error) {
        logger.error('Failed to add task', error, { context: { title } });
        setError(error);

        Sentry.captureException(error, {
          tags: {
            operation: 'add_task',
            error_code: error.code || 'unknown',
          },
          extra: {
            title,
            description,
            error_details: error.details,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 1, message: 'Database error' });
      } else {
        logger.info('Task added successfully', {
          context: {
            taskId: data.id,
            title,
          },
        });

        setTasks([data, ...tasks]);
        setError(null);

        Sentry.addBreadcrumb({
          message: 'Task added successfully',
          category: 'task.create',
          level: 'info',
          data: {
            task_id: data.id,
            title,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 2 }); // OK
        span.setAttribute('task_id', data.id);
        span.setAttribute('task_title', title);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error adding task', pgError, { context: { title } });
      setError(pgError);

      Sentry.captureException(pgError, {
        tags: { operation: 'add_task_unexpected' },
        extra: { title, description, component: 'TaskContext' },
      });

      span.setStatus({ code: 1, message: 'Unexpected error' });
    } finally {
      span.end();
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskContext.updateTask',
      op: 'db.update',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'Updating task',
        category: 'task.update',
        level: 'info',
        data: {
          task_id: id,
          update_fields: Object.keys(updates),
        },
      });

      const startTime = Date.now();
      const { error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
      const duration = Date.now() - startTime;

      Sentry.setMeasurement('task_update_duration_ms', duration, 'millisecond');

      if (error) {
        logger.error('Failed to update task', error, {
          context: { taskId: id },
        });
        setError(error);

        Sentry.captureException(error, {
          tags: {
            operation: 'update_task',
            error_code: error.code || 'unknown',
          },
          extra: {
            task_id: id,
            updates,
            error_details: error.details,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 1, message: 'Database error' });
      } else {
        logger.info('Task updated successfully', {
          context: {
            taskId: id,
            updates: Object.keys(updates),
          },
        });

        setTasks(tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)));
        setError(null);

        Sentry.addBreadcrumb({
          message: 'Task updated successfully',
          category: 'task.update',
          level: 'info',
          data: {
            task_id: id,
            update_fields: Object.keys(updates),
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 2 }); // OK
        span.setAttribute('task_id', id);
        span.setAttribute('update_fields_count', Object.keys(updates).length);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error updating task', pgError, {
        context: { taskId: id },
      });
      setError(pgError);

      Sentry.captureException(pgError, {
        tags: { operation: 'update_task_unexpected' },
        extra: { task_id: id, updates, component: 'TaskContext' },
      });

      span.setStatus({ code: 1, message: 'Unexpected error' });
    } finally {
      span.end();
    }
  };

  const toggleTask = async (id: string) => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskContext.toggleTask',
      op: 'task.toggle',
    });

    try {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        Sentry.addBreadcrumb({
          message: 'Toggling task completion status',
          category: 'task.toggle',
          level: 'info',
          data: {
            task_id: id,
            current_status: task.completed,
            new_status: !task.completed,
          },
        });

        await updateTask(id, { completed: !task.completed });

        span.setStatus({ code: 2 }); // OK
        span.setAttribute('task_id', id);
        span.setAttribute('toggled_to', !task.completed);
      } else {
        const error = new Error(`Task with id ${id} not found`);

        Sentry.captureException(error, {
          tags: { operation: 'toggle_task_not_found' },
          extra: { task_id: id, component: 'TaskContext' },
        });

        span.setStatus({ code: 1, message: 'Task not found' });
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'toggle_task_unexpected' },
        extra: { task_id: id, component: 'TaskContext' },
      });

      span.setStatus({ code: 1, message: 'Unexpected error' });
    } finally {
      span.end();
    }
  };

  const deleteTask = async (id: string) => {
    const span = Sentry.startInactiveSpan({
      name: 'TaskContext.deleteTask',
      op: 'db.delete',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'Deleting task',
        category: 'task.delete',
        level: 'info',
        data: { task_id: id },
      });

      const startTime = Date.now();
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      const duration = Date.now() - startTime;

      Sentry.setMeasurement('task_delete_duration_ms', duration, 'millisecond');

      if (error) {
        logger.error('Failed to delete task', error, {
          context: { taskId: id },
        });
        setError(error);

        Sentry.captureException(error, {
          tags: {
            operation: 'delete_task',
            error_code: error.code || 'unknown',
          },
          extra: {
            task_id: id,
            error_details: error.details,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 1, message: 'Database error' });
      } else {
        logger.info('Task deleted successfully', {
          context: { taskId: id },
        });

        setTasks(tasks.filter((task) => task.id !== id));
        setError(null);

        Sentry.addBreadcrumb({
          message: 'Task deleted successfully',
          category: 'task.delete',
          level: 'info',
          data: {
            task_id: id,
            duration_ms: duration,
          },
        });

        span.setStatus({ code: 2 }); // OK
        span.setAttribute('task_id', id);
      }
    } catch (error) {
      const pgError = error as PostgrestError;
      logger.error('Unexpected error deleting task', pgError, {
        context: { taskId: id },
      });
      setError(pgError);

      Sentry.captureException(pgError, {
        tags: { operation: 'delete_task_unexpected' },
        extra: { task_id: id, component: 'TaskContext' },
      });

      span.setStatus({ code: 1, message: 'Unexpected error' });
    } finally {
      span.end();
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
