
"use client";

import type { Task } from '@/types/task';
import { TaskItem } from './task-item';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListTodo, BellRing } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (task: Task) => void;
  editingTaskId: string | null;
}

export function TaskList({ tasks, onToggleComplete, onRemove, onStartEdit, editingTaskId }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <ListTodo className="mx-auto h-12 w-12 mb-4" />
        <p className="text-lg">Your to-do list is empty.</p>
        <p>Use the microphone buttons to add tasks!</p>
        <p className="mt-2 text-sm flex items-center justify-center">
          <BellRing className="h-4 w-4 mr-1.5"/> Try adding tasks with times like "Meeting tomorrow at 2pm" for reminders.
        </p>
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    const aTime = a.dueAt || a.createdAt;
    const bTime = b.dueAt || b.createdAt;
    return aTime - bTime;
  });


  return (
    <ScrollArea className="h-[350px] w-full rounded-md border border-border p-1">
      <div className="space-y-3 p-3">
        {sortedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onRemove={onRemove}
            onStartEdit={onStartEdit}
            isEditing={editingTaskId === task.id}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

