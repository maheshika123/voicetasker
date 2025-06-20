
"use server";

import { transcribeVoiceTask } from "@/ai/flows/transcribe-voice-task";
import { markTaskComplete as markTaskCompleteFlow } from "@/ai/flows/mark-task-complete";
import { editTask as editTaskFlow, type EditTaskOutput } from "@/ai/flows/edit-task-flow";
import { suggestPriorityTask, type FlowTask } from "@/ai/flows/prioritize-tasks-flow";
import { disambiguateTaskIntent, type FlowTaskBrief } from "@/ai/flows/disambiguate-task-intent-flow";
// import { categorizeTask } from "@/ai/flows/categorize-task-flow"; -- REMOVED
import type { Task } from "@/types/task";


export interface ProcessedTaskResult {
  originalTranscribedText: string | null;
  isPotentialEdit: boolean;
  matchedTaskId: string | null;
  proposedTaskText: string | null;
  proposedDueAt: number | null;
  proposedExtractedTimeDescription: string | null;
  // proposedCategory: string | null; -- REMOVED
  reasonForSuggestion: string | null;
  error: string | null;
}

export async function processVoiceCommandForTask(
  voiceDataUri: string,
  currentIncompleteTasks: Task[]
): Promise<ProcessedTaskResult> {
  let originalTranscribedText: string | null = null;
  try {
    const transcriptionResult = await transcribeVoiceTask({ voiceDataUri });
    originalTranscribedText = transcriptionResult.transcribedText;

    if (!originalTranscribedText) {
      return { 
        originalTranscribedText: null,
        isPotentialEdit: false, 
        matchedTaskId: null, 
        proposedTaskText: null, 
        proposedDueAt: null, 
        proposedExtractedTimeDescription: null,
        // proposedCategory: null, -- REMOVED
        reasonForSuggestion: null,
        error: "Transcription failed or returned empty." 
      };
    }

    const referenceTimeISO = new Date().toISOString();
    
    const existingTasksBrief: FlowTaskBrief[] = currentIncompleteTasks.map(task => ({
        id: task.id,
        text: task.text,
        dueAtISO: task.dueAt ? new Date(task.dueAt).toISOString() : null,
        extractedTimeDescription: task.extractedTimeDescription || null,
    }));

    const disambiguationResult = await disambiguateTaskIntent({
      voiceCommandText: originalTranscribedText,
      existingTasks: existingTasksBrief,
      referenceTimeISO,
    });

    // let categoryResult: string | null = null; -- REMOVED
    // if (disambiguationResult.proposedTaskText) { -- REMOVED
    //     const categorization = await categorizeTask({taskText: disambiguationResult.proposedTaskText}); -- REMOVED
    //     categoryResult = categorization.category; -- REMOVED
    // } -- REMOVED

    return {
      originalTranscribedText,
      isPotentialEdit: disambiguationResult.isPotentialEdit,
      matchedTaskId: disambiguationResult.matchedTaskId,
      proposedTaskText: disambiguationResult.proposedTaskText,
      proposedDueAt: disambiguationResult.proposedDueAtTimestamp,
      proposedExtractedTimeDescription: disambiguationResult.proposedExtractedTimeDescription,
      // proposedCategory: categoryResult, -- REMOVED
      reasonForSuggestion: disambiguationResult.reasonForSuggestion,
      error: null
    };

  } catch (error) {
    console.error("Error in processVoiceCommandForTask:", error);
    let errorMessage = "Failed to process voice input for task.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      errorMessage = (error as { message: string }).message;
    }
    
    return { 
        originalTranscribedText: originalTranscribedText || "Transcription failed.",
        isPotentialEdit: false, 
        matchedTaskId: null, 
        proposedTaskText: originalTranscribedText, 
        proposedDueAt: null, 
        proposedExtractedTimeDescription: null,
        // proposedCategory: null, -- REMOVED
        reasonForSuggestion: "Processing error occurred.",
        error: errorMessage 
    };
  }
}

export async function handleMarkTaskComplete(
  voiceDataUri: string,
  currentTasks: Task[]
): Promise<{ completedTaskText: string | null; updatedTaskListTexts: string[] | null; error: string | null }> {
  try {
    const transcriptionResult = await transcribeVoiceTask({ voiceDataUri });
    if (!transcriptionResult.transcribedText) {
      return { completedTaskText: null, updatedTaskListTexts: null, error: "Could not understand voice command for completion." };
    }
    const voiceCommand = transcriptionResult.transcribedText;

    const taskListTexts = currentTasks.filter(task => !task.completed).map(task => task.text);
    if (taskListTexts.length === 0) {
        return { completedTaskText: null, updatedTaskListTexts: [], error: "No pending tasks to complete." };
    }
    
    const completionResult = await markTaskCompleteFlow({
      voiceCommand,
      taskList: taskListTexts,
    });

    if (completionResult.completedTask) {
      return {
        completedTaskText: completionResult.completedTask,
        updatedTaskListTexts: completionResult.updatedTaskList,
        error: null,
      };
    } else {
      return {
        completedTaskText: null,
        updatedTaskListTexts: completionResult.updatedTaskList, 
        error: "No specific task was identified for completion by the AI.",
      };
    }

  } catch (error) {
    console.error("Error in handleMarkTaskComplete:", error);
    let errorMessage = "Failed to process task completion.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      errorMessage = (error as { message: string }).message;
    }
    return { completedTaskText: null, updatedTaskListTexts: null, error: errorMessage };
  }
}

export interface EditTaskResult {
  updatedTaskDetails?: {
    text: string;
    dueAt: number | null;
    extractedTimeDescription: string | null;
    // category?: string | null; -- REMOVED
  };
  changeSummary?: string;
  noChangesMade?: boolean;
  error?: string | null;
}

export async function processVoiceCommandForTaskEdit(
  voiceDataUri: string,
  taskToEdit: Task
): Promise<EditTaskResult> {
  try {
    const transcriptionResult = await transcribeVoiceTask({ voiceDataUri });
    if (!transcriptionResult.transcribedText) {
      return { error: "Transcription failed or returned empty." };
    }
    const voiceCommand = transcriptionResult.transcribedText;

    const referenceTimeISO = new Date().toISOString();
    const currentTaskDueAtISO = taskToEdit.dueAt ? new Date(taskToEdit.dueAt).toISOString() : null;

    const editFlowResult: EditTaskOutput = await editTaskFlow({
      voiceCommand,
      currentTaskText: taskToEdit.text,
      currentTaskDueAtISO,
      currentTaskExtractedTimeDescription: taskToEdit.extractedTimeDescription || null,
      referenceTimeISO,
    });

    if (editFlowResult.noChangesMade) {
      return {
        noChangesMade: true,
        changeSummary: editFlowResult.changeSummary || "No changes were made to the task.",
      };
    }
    
    // let newCategory = taskToEdit.category; -- REMOVED
    // if (editFlowResult.updatedTaskText !== taskToEdit.text) { -- REMOVED
    //     const categorization = await categorizeTask({taskText: editFlowResult.updatedTaskText}); -- REMOVED
    //     newCategory = categorization.category; -- REMOVED
    // } -- REMOVED


    return {
      updatedTaskDetails: {
        text: editFlowResult.updatedTaskText,
        dueAt: editFlowResult.newDueAtTimestamp,
        extractedTimeDescription: editFlowResult.newExtractedTimeDescription,
        // category: newCategory, -- REMOVED (if it was here before)
      },
      changeSummary: editFlowResult.changeSummary,
      noChangesMade: false,
      error: null,
    };

  } catch (error) {
    console.error("Error in processVoiceCommandForTaskEdit:", error);
    let errorMessage = "Failed to process voice input for task edit.";
     if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      errorMessage = (error as { message: string }).message;
    }
    return { error: errorMessage };
  }
}

export interface SuggestionResult {
  suggestedTask?: {
    id: string;
    text: string;
  };
  reason?: string;
  noSpecificSuggestion?: boolean;
  error?: string | null;
}

export async function getTaskSuggestion(currentTasks: Task[]): Promise<SuggestionResult> {
  try {
    const incompleteTasks: FlowTask[] = currentTasks
      .filter(task => !task.completed)
      .map(task => ({
        id: task.id,
        text: task.text,
        createdAtISO: new Date(task.createdAt).toISOString(),
        dueAtISO: task.dueAt ? new Date(task.dueAt).toISOString() : null,
        extractedTimeDescription: task.extractedTimeDescription || null,
        isCompleted: false, 
      }));

    if (incompleteTasks.length === 0) {
      return { noSpecificSuggestion: true, reason: "You have no pending tasks!" };
    }

    const referenceTimeISO = new Date().toISOString();
    const suggestionOutput = await suggestPriorityTask({ taskList: incompleteTasks, referenceTimeISO });

    if (suggestionOutput.noSpecificSuggestion || !suggestionOutput.suggestedTaskId || !suggestionOutput.suggestedTaskText) {
      return {
        noSpecificSuggestion: true,
        reason: suggestionOutput.reason || "AI could not determine a specific priority task.",
      };
    }

    return {
      suggestedTask: {
        id: suggestionOutput.suggestedTaskId,
        text: suggestionOutput.suggestedTaskText,
      },
      reason: suggestionOutput.reason,
      noSpecificSuggestion: false,
      error: null,
    };

  } catch (error) {
    console.error("Error in getTaskSuggestion:", error);
    let errorMessage = "Failed to get task suggestion.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      errorMessage = (error as { message: string }).message;
    }
    return { error: errorMessage, noSpecificSuggestion: true };
  }
}
