
"use client";

import type { Task } from '@/types/task';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge"; // -- REMOVED
import { Trash2, Clock, Pencil } from 'lucide-react'; // Removed Tag icon
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (task: Task) => void;
  isEditing: boolean;
}

export function TaskItem({ task, onToggleComplete, onRemove, onStartEdit, isEditing }: TaskItemProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 rounded-lg shadow-md transition-all duration-300 ease-in-out relative",
        task.completed ? "bg-secondary/50" : "bg-card hover:bg-card/90",
        isEditing ? "ring-2 ring-primary shadow-lg" : ""
      )}
      aria-labelledby={`task-text-${task.id}`}
    >
      {isEditing && (
        <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full shadow-md">
          Editing
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start space-x-3">
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={() => onToggleComplete(task.id)}
            aria-label={task.completed ? `Mark ${task.text} as incomplete` : `Mark ${task.text} as complete`}
            className="transition-all duration-300 ease-in-out mt-1 shrink-0"
            disabled={isEditing}
          />
          <div className="flex-1 min-w-0">
            <label
              htmlFor={`task-${task.id}`}
              id={`task-text-${task.id}`}
              className={cn(
                "text-base transition-all duration-300 ease-in-out block",
                task.completed ? "line-through text-muted-foreground" : "text-foreground",
                isEditing ? "cursor-default" : "cursor-pointer"
              )}
            >
              {task.text}
            </label>
            <div className="flex flex-wrap items-center mt-1 space-x-3">
              {task.extractedTimeDescription && (
                <p className={cn(
                  "text-xs text-muted-foreground flex items-center",
                  task.completed ? "line-through" : ""
                )}>
                  <Clock className="h-3 w-3 mr-1.5 shrink-0" />
                  {task.extractedTimeDescription}
                </p>
              )}
              {/* {task.category && ( -- REMOVED
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs py-0.5 px-1.5",
                    task.completed ? "border-muted-foreground/50 text-muted-foreground/70" : "border-accent/80 text-accent-foreground"
                  )}
                >
                  <Tag className="h-3 w-3 mr-1 shrink-0" />
                  {task.category}
                </Badge>
              )} -- REMOVED */}
            </div>
          </div>
        </div>
      </div>
      <div className="flex space-x-1 shrink-0 ml-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStartEdit(task)}
          aria-label={`Edit task: ${task.text}`}
          className="text-muted-foreground hover:text-primary transition-colors"
          disabled={task.completed || isEditing}
        >
          <Pencil className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(task.id)}
          aria-label={`Remove task: ${task.text}`}
          className="text-muted-foreground hover:text-destructive transition-colors"
          disabled={isEditing}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
