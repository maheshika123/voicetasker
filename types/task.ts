
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number; // Store as timestamp for easier sorting
  updatedAt?: number; // Timestamp for when the task was last updated
  dueAt?: number | null; // Timestamp for when the task is due
  extractedTimeDescription?: string | null; // e.g., "Tomorrow at 2 PM"
  // category?: string | null; // AI-suggested category -- REMOVED
  notificationIds?: { // To store IDs of scheduled notifications for cancellation
    reminder?: string; // For 15-min reminder
    dueTime?: string;  // For on-time reminder
  };
}
