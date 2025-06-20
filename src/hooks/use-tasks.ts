
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '@/types/task';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_KEY = 'voiceTaskerTasks';
const REMINDER_BEFORE_DUE_MS = 15 * 60 * 1000; // 15 minutes

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { toast } = useToast();
  const scheduledNotificationsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedTasks) {
        const parsedTasks = JSON.parse(storedTasks) as Task[];
        setTasks(parsedTasks);
        parsedTasks.forEach(task => {
          if (!task.completed && task.dueAt && task.dueAt > Date.now()) {
            scheduleTaskNotifications(task);
          }
        });
      }
    } catch (error) {
      console.error("Failed to load tasks from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks to localStorage:", error);
    }
  }, [tasks]);

  const showSystemNotification = useCallback((title: string, options: NotificationOptions) => {
    if (!("Notification" in window)) {
      toast({ title: "Notifications not supported", description: options.body as string });
      return;
    }
    if (Notification.permission === "granted") {
      if (navigator.serviceWorker.controller) {
         navigator.serviceWorker.ready.then(registration => {
           registration.showNotification(title, options);
         });
      } else {
        new Notification(title, options);
      }
    } else {
      toast({ title: "Notification Permission Needed", description: "Please enable notifications to receive reminders." });
    }
  }, [toast]);
  
  const scheduleNotificationWithTimeout = useCallback((id: string, title: string, options: NotificationOptions, delay: number) => {
    if (delay < 0) return;

    const existingTimeout = scheduledNotificationsRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(() => {
      showSystemNotification(title, options);
      scheduledNotificationsRef.current.delete(id);
    }, delay);
    scheduledNotificationsRef.current.set(id, timeoutId);
  }, [showSystemNotification]);

  const cancelScheduledNotification = useCallback((id: string) => {
    const timeoutId = scheduledNotificationsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      scheduledNotificationsRef.current.delete(id);
    }
  }, []);

  const scheduleTaskNotifications = useCallback((task: Task) => {
    if (!task.dueAt || task.completed) return;

    const now = Date.now();
    const reminderTime = task.dueAt - REMINDER_BEFORE_DUE_MS;
    const dueTime = task.dueAt;

    const reminderNotificationId = `reminder-${task.id}`;
    const dueTimeNotificationId = `due-${task.id}`;

    cancelScheduledNotification(reminderNotificationId);
    cancelScheduledNotification(dueTimeNotificationId);

    if (reminderTime > now) {
      scheduleNotificationWithTimeout(
        reminderNotificationId,
        `Reminder: ${task.text}`,
        { body: `Due in 15 minutes. (${task.extractedTimeDescription || ''})`, tag: reminderNotificationId, renotify: true, icon: '/icon-192x192.png' },
        reminderTime - now
      );
    }

    if (dueTime > now) {
      scheduleNotificationWithTimeout(
        dueTimeNotificationId,
        `Task Due: ${task.text}`,
        { body: `It's time for your task! (${task.extractedTimeDescription || ''})`, tag: dueTimeNotificationId, renotify: true, icon: '/icon-192x192.png' },
        dueTime - now
      );
    }
  }, [scheduleNotificationWithTimeout, cancelScheduledNotification]);


  const addTask = useCallback((
    text: string, 
    dueAt: number | null, 
    extractedTimeDescription: string | null
    // category: string | null = null -- REMOVED
  ) => {
    if (!text.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: Date.now(),
      dueAt,
      extractedTimeDescription,
      // category, -- REMOVED
    };
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => (a.dueAt || a.createdAt) - (b.dueAt || b.createdAt)));
    if (newTask.dueAt) {
      scheduleTaskNotifications(newTask);
    }
  }, [scheduleTaskNotifications]);

  const toggleTask = useCallback((id: string) => {
    let completedTask: Task | undefined;
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === id) {
          completedTask = { ...task, completed: !task.completed };
          return completedTask;
        }
        return task;
      })
    );

    if (completedTask) {
      if (completedTask.completed && completedTask.dueAt) {
        cancelScheduledNotification(`reminder-${completedTask.id}`);
        cancelScheduledNotification(`due-${completedTask.id}`);
      } else if (completedTask.completed && !completedTask.dueAt) {
        const remainingTasks = tasks.filter(t => !t.completed && t.id !== completedTask?.id);
        if (remainingTasks.length > 0) {
          showSystemNotification("VoiceTasker", { body: "There are more tasks remaining.", tag: "more-tasks-reminder", icon: '/icon-192x192.png' });
        }
      } else if (!completedTask.completed && completedTask.dueAt) {
        scheduleTaskNotifications(completedTask);
      }
    }
  }, [tasks, cancelScheduledNotification, scheduleTaskNotifications, showSystemNotification]);
  
  const removeTask = useCallback((id: string) => {
    const taskToRemove = tasks.find(task => task.id === id);
    setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
    if (taskToRemove && taskToRemove.dueAt) {
      cancelScheduledNotification(`reminder-${taskToRemove.id}`);
      cancelScheduledNotification(`due-${taskToRemove.id}`);
    }
  }, [tasks, cancelScheduledNotification]);

  const editTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    let editedTask: Task | undefined;
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === id) {
          // Remove category from updates if it exists
          const { ...restUpdates } = updates;
          editedTask = { ...task, ...restUpdates, updatedAt: Date.now() };
          return editedTask;
        }
        return task;
      }).sort((a, b) => (a.dueAt || a.createdAt) - (b.dueAt || b.createdAt))
    );

    if (editedTask) {
      if (updates.dueAt !== undefined || (updates.completed === false && editedTask.dueAt)) {
        scheduleTaskNotifications(editedTask);
      }
      if (updates.completed === true && editedTask.dueAt) {
        cancelScheduledNotification(`reminder-${editedTask.id}`);
        cancelScheduledNotification(`due-${editedTask.id}`);
      }
    }
  }, [scheduleTaskNotifications, cancelScheduledNotification]);
  

  return { tasks, addTask, toggleTask, removeTask, editTask, setTasks };
}
