
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTasks } from '@/hooks/use-tasks';
import type { Task } from '@/types/task';
import { TaskList } from '@/components/voice-tasker/task-list';
import { RecordButton } from '@/components/voice-tasker/record-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { processVoiceCommandForTask, handleMarkTaskComplete, processVoiceCommandForTaskEdit, getTaskSuggestion, type ProcessedTaskResult } from '@/lib/actions';
import type { EditTaskResult, SuggestionResult } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Mic, CheckCircle, Sparkles, Info, PencilLine, Lightbulb, Loader2 } from 'lucide-react';
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { requestNotificationPermission } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export default function HomePage() {
  const { tasks, addTask, toggleTask, removeTask, editTask } = useTasks();
  const { toast } = useToast();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSuggestingTask, setIsSuggestingTask] = useState(false);

  const [showDisambiguationAlert, setShowDisambiguationAlert] = useState(false);
  const [disambiguationData, setDisambiguationData] = useState<ProcessedTaskResult | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined' && "Notification" in window && Notification.permission !== "granted") {
      requestNotificationPermission().then(token => {
        if (token) {
          console.log("FCM Token obtained on page load:", token);
        }
      });
    }
  }, []);

  const onAddTaskRecordingComplete = async (audioDataUri: string) => {
    const { dismiss: dismissLoadingToast } = toast({ title: "Processing Task...", description: "AI is transcribing and understanding your task."});
    const result = await processVoiceCommandForTask(audioDataUri, tasks.filter(t => !t.completed));
    dismissLoadingToast();

    if (result.error) {
      toast({ variant: "destructive", title: "Error Adding Task", description: result.error });
    } else if (result.isPotentialEdit && result.matchedTaskId && result.proposedTaskText) {
      setDisambiguationData(result); 
      setShowDisambiguationAlert(true);
    } else if (result.proposedTaskText) {
      addTask(
        result.proposedTaskText, 
        result.proposedDueAt, 
        result.proposedExtractedTimeDescription
        // result.proposedCategory -- REMOVED
      );
      let toastMessage = `"${result.proposedTaskText}" added to your list.`;
      if (result.proposedExtractedTimeDescription) {
        toastMessage += ` Due: ${result.proposedExtractedTimeDescription}.`;
      }
      // if (result.proposedCategory) { -- REMOVED
      //   toastMessage += ` Category: ${result.proposedCategory}.`; -- REMOVED
      // } -- REMOVED
      toast({ title: "Task Added", description: toastMessage });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Transcription returned no text or failed to process." });
    }
  };

  const handleDisambiguationChoice = (choice: 'update' | 'create_new') => {
    if (!disambiguationData) return;

    if (choice === 'update' && disambiguationData.matchedTaskId && disambiguationData.proposedTaskText) {
      editTask(disambiguationData.matchedTaskId, {
        text: disambiguationData.proposedTaskText,
        dueAt: disambiguationData.proposedDueAt,
        extractedTimeDescription: disambiguationData.proposedExtractedTimeDescription,
        // category: disambiguationData.proposedCategory, -- REMOVED
      });
      toast({ title: "Task Updated", description: `Task updated to: "${disambiguationData.proposedTaskText}"`});
    } else if (choice === 'create_new' && disambiguationData.proposedTaskText) {
      addTask(
        disambiguationData.proposedTaskText,
        disambiguationData.proposedDueAt,
        disambiguationData.proposedExtractedTimeDescription
        // disambiguationData.proposedCategory -- REMOVED
      );
      let toastMessage = `New task "${disambiguationData.proposedTaskText}" added.`;
      if (disambiguationData.proposedExtractedTimeDescription) {
        toastMessage += ` Due: ${disambiguationData.proposedExtractedTimeDescription}.`;
      }
      // if (disambiguationData.proposedCategory) { -- REMOVED
      //   toastMessage += ` Category: ${disambiguationData.proposedCategory}.`; -- REMOVED
      // } -- REMOVED
      toast({ title: "New Task Created", description: toastMessage });
    }
    setShowDisambiguationAlert(false);
    setDisambiguationData(null);
  };


  const onCompleteTaskRecordingComplete = async (audioDataUri: string) => {
    if (tasks.filter(t => !t.completed).length === 0) {
      toast({ title: "All Done!", description: "No pending tasks to complete." });
      return;
    }
    const { dismiss: dismissLoadingToast } = toast({ title: "Identifying Task...", description: "AI is processing your completion command."});
    const { completedTaskText, error } = await handleMarkTaskComplete(audioDataUri, tasks);
    dismissLoadingToast();
    
    if (error) {
      toast({ variant: "destructive", title: "Error Completing Task", description: error });
    } else if (completedTaskText) {
      const taskToComplete = tasks.find(t => t.text === completedTaskText && !t.completed);
      if (taskToComplete) {
        toggleTask(taskToComplete.id); 
        toast({ title: "Task Completed!", description: `"${completedTaskText}" marked as done.` });
      } else {
        toast({ variant: "destructive", title: "Task Not Found", description: `Could not find an incomplete task: "${completedTaskText}"` });
      }
    } else {
       toast({ title: "No Task Identified", description: "Couldn't identify a task to complete from your voice input." });
    }
  };

  const handleStartEditTask = (task: Task) => {
    setEditingTask(task);
    toast({ title: "Editing Task", description: `Speak your changes for: "${task.text}"`});
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    toast({ title: "Edit Cancelled" });
  };

  const onEditTaskRecordingComplete = async (audioDataUri: string) => {
    if (!editingTask) return;

    const { dismiss: dismissLoadingToast } = toast({ title: "Processing Edit...", description: "AI is understanding your changes."});
    const result: EditTaskResult = await processVoiceCommandForTaskEdit(audioDataUri, editingTask);
    dismissLoadingToast();

    if (result.error) {
      toast({ variant: "destructive", title: "Error Editing Task", description: result.error });
    } else if (result.noChangesMade) {
      toast({ title: "No Changes Made", description: result.changeSummary || "The AI determined no changes were requested." });
    } else if (result.updatedTaskDetails) {
      editTask(editingTask.id, result.updatedTaskDetails); 
      toast({ title: "Task Updated", description: result.changeSummary || `Task "${result.updatedTaskDetails.text}" has been updated.` });
    } else {
      toast({ variant: "destructive", title: "Edit Failed", description: "An unknown error occurred while editing the task." });
    }
    setEditingTask(null);
  };

  const handleSuggestTask = async () => {
    setIsSuggestingTask(true);
    const { dismiss: dismissLoadingToast } = toast({ title: "Thinking...", description: "AI is analyzing your tasks to suggest what to do next."});
    
    const result: SuggestionResult = await getTaskSuggestion(tasks);
    dismissLoadingToast();
    setIsSuggestingTask(false);

    if (result.error) {
      toast({ variant: "destructive", title: "Suggestion Error", description: result.error });
    } else if (result.noSpecificSuggestion || !result.suggestedTask) {
      toast({ title: "Task Suggestion", description: result.reason || "No specific task suggestion at this time." });
    } else {
      toast({
        title: "AI Suggests:",
        description: (
          <div>
            <p className="font-semibold">{result.suggestedTask.text}</p>
            {result.reason && <p className="text-sm text-muted-foreground mt-1">{result.reason}</p>}
          </div>
        ),
      });
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 selection:bg-primary/40 selection:text-primary-foreground bg-background text-foreground">
      <div className="fixed top-4 right-4 flex items-center space-x-2 z-50">
        <Button asChild variant="outline" size="icon" className="rounded-full shadow-md bg-background hover:bg-accent hover:text-accent-foreground" aria-label="About VoiceTasker">
          <Link href="/about">
            <Info className="h-[1.2rem] w-[1.2rem]" />
          </Link>
        </Button>
        <ThemeToggleButton />
      </div>
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            VoiceTasker
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Your AI-powered voice to-do list. Reminders included!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {editingTask && (
            <Alert variant="default" className="bg-primary/10 border-primary/30">
              <PencilLine className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary">Editing Task: <span className="font-normal text-foreground">{editingTask.text}</span></AlertTitle>
              <AlertDescription className="text-foreground/80">
                Use the "Record Edit Command" button below to speak your changes for this task.
                Or <Button variant="link" size="sm" className="p-0 h-auto text-destructive hover:text-destructive/80" onClick={handleCancelEdit}>cancel edit</Button>.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordButton
              onRecordingComplete={onAddTaskRecordingComplete}
              buttonText="Add New Task"
              processingText="Processing Task..."
              variant="default"
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg"
              idleIcon={<Mic className="mr-2 h-6 w-6" />}
              disabled={!!editingTask || isSuggestingTask || showDisambiguationAlert}
            />
            <RecordButton
              onRecordingComplete={onCompleteTaskRecordingComplete}
              buttonText="Mark Task Done"
              processingText="Identifying Task..."
              variant="secondary"
              className="bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-lg"
              idleIcon={<CheckCircle className="mr-2 h-6 w-6" />}
              disabled={!!editingTask || tasks.filter(t => !t.completed).length === 0 || isSuggestingTask || showDisambiguationAlert}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleSuggestTask}
              variant="outline"
              className="border-purple-500 text-purple-500 hover:bg-purple-500/10 hover:text-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-400/10 dark:hover:text-purple-300 py-6 text-lg w-full"
              disabled={!!editingTask || tasks.filter(t => !t.completed).length === 0 || isSuggestingTask || showDisambiguationAlert}
            >
              {isSuggestingTask ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              ) : (
                <Lightbulb className="mr-2 h-6 w-6" />
              )}
              What Should I Do Next?
            </Button>
          </div>
           {editingTask && (
             <div className="mt-4">
              <RecordButton
                onRecordingComplete={onEditTaskRecordingComplete}
                buttonText="Record Edit Command"
                processingText="Processing Edit..."
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 hover:text-primary py-6 text-lg w-full"
                idleIcon={<PencilLine className="mr-2 h-6 w-6" />}
                disabled={isSuggestingTask || showDisambiguationAlert}
              />
            </div>
           )}
          
          <Separator className="my-6 bg-border/50" />

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">My Tasks</h2>
            <TaskList 
              tasks={tasks} 
              onToggleComplete={toggleTask} 
              onRemove={removeTask}
              onStartEdit={handleStartEditTask}
              editingTaskId={editingTask?.id || null}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDisambiguationAlert} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setDisambiguationData(null); // Clear data when closing
          }
          setShowDisambiguationAlert(isOpen);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update or Create New Task?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <div className="mb-2">You said: <strong className="text-foreground">"{disambiguationData?.originalTranscribedText}"</strong></div>
                {disambiguationData?.isPotentialEdit && disambiguationData.matchedTaskId && (
                  <div className="mb-2">
                    This seems related to your task: <strong className="text-foreground">"{tasks.find(t => t.id === disambiguationData.matchedTaskId)?.text}"</strong>.
                  </div>
                )}
                <div className="mb-1">{disambiguationData?.reasonForSuggestion}</div>
                <div className="mt-3 mb-1 font-semibold">AI's understanding for the task:</div>
                <div className="text-foreground">"{disambiguationData?.proposedTaskText}"</div>
                {disambiguationData?.proposedExtractedTimeDescription && (
                  <div className="text-sm text-muted-foreground">Due: {disambiguationData.proposedExtractedTimeDescription}</div>
                )}
                {/* {disambiguationData?.proposedCategory && ( -- REMOVED
                  <div className="text-sm text-muted-foreground">Category: {disambiguationData.proposedCategory}</div> -- REMOVED
                )} -- REMOVED */}
                <div className="mt-4">Would you like to update the existing task or create a new one based on this understanding?</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDisambiguationAlert(false);
              setDisambiguationData(null);
            }}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => handleDisambiguationChoice('create_new')}>Create New Task</Button>
            {disambiguationData?.isPotentialEdit && disambiguationData.matchedTaskId && (
                <Button onClick={() => handleDisambiguationChoice('update')}>Update Existing Task</Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="mt-8 text-center text-sm text-muted-foreground space-y-2">
        <p>&copy; {new Date().getFullYear()} VoiceTasker. Powered by AI.</p>
        <p>Tip: Grant notification permissions for reminders!</p>
      </footer>
    </div>
  );
}
