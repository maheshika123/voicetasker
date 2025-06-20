'use server';

/**
 * @fileOverview A flow that marks a task as complete based on voice command.
 *
 * - markTaskComplete - A function that handles the task completion process.
 * - MarkTaskCompleteInput - The input type for the markTaskComplete function.
 * - MarkTaskCompleteOutput - The return type for the markTaskComplete function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarkTaskCompleteInputSchema = z.object({
  voiceCommand: z
    .string()
    .describe('The voice command spoken by the user, transcribed to text.'),
  taskList: z.array(z.string()).describe('The current list of tasks.'),
});
export type MarkTaskCompleteInput = z.infer<typeof MarkTaskCompleteInputSchema>;

const MarkTaskCompleteOutputSchema = z.object({
  completedTask: z
    .string()
    .nullable()
    .describe('The task that was identified as completed, or null if no task was matched.'),
  updatedTaskList: z
    .array(z.string())
    .describe('The updated list of tasks with the completed task removed.'),
});
export type MarkTaskCompleteOutput = z.infer<typeof MarkTaskCompleteOutputSchema>;

export async function markTaskComplete(input: MarkTaskCompleteInput): Promise<MarkTaskCompleteOutput> {
  return markTaskCompleteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'markTaskCompletePrompt',
  input: {schema: MarkTaskCompleteInputSchema},
  output: {schema: MarkTaskCompleteOutputSchema},
  prompt: `You are a task management assistant. The user has provided a voice command and a list of tasks.

  Your goal is to identify if the voice command indicates that a task has been completed. If it does, identify which task was completed and return it in the completedTask field.  If the voice command does not clearly indicate a task completion, or if you can't identify the task, return null for completedTask.

  If you identify a completed task, also return the updatedTaskList with the completed task removed. If no task is completed return the original task list.

  Voice Command: {{{voiceCommand}}}

  Task List:
  {{#each taskList}}- {{{this}}}
  {{/each}}`,
});

const markTaskCompleteFlow = ai.defineFlow(
  {
    name: 'markTaskCompleteFlow',
    inputSchema: MarkTaskCompleteInputSchema,
    outputSchema: MarkTaskCompleteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
