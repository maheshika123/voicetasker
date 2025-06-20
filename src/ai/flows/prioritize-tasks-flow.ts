
'use server';
/**
 * @fileOverview Suggests a priority task from a list.
 *
 * - suggestPriorityTask - A function to get a task suggestion.
 * - PrioritizeTasksInput - The input type for the flow.
 * - PrioritizeTasksOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the structure for individual tasks passed to the flow
const FlowTaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAtISO: z.string().describe("Task creation date in ISO 8601 format (UTC)."),
  dueAtISO: z.string().nullable().describe("Task due date in ISO 8601 format (UTC), if any."),
  extractedTimeDescription: z.string().nullable().describe("Human-friendly description of the due time, if any."),
  isCompleted: z.boolean().describe("Whether the task is completed. This should always be false for tasks sent to this flow."),
});
export type FlowTask = z.infer<typeof FlowTaskSchema>;

const PrioritizeTasksInputSchema = z.object({
  taskList: z.array(FlowTaskSchema).describe('The list of currently incomplete tasks.'),
  referenceTimeISO: z.string().describe('The current time in ISO 8601 format (UTC), to provide context for due dates and task aging.'),
});
export type PrioritizeTasksInput = z.infer<typeof PrioritizeTasksInputSchema>;

const PrioritizeTasksOutputSchema = z.object({
  suggestedTaskId: z.string().nullable().describe('The ID of the suggested priority task, or null if no specific suggestion.'),
  suggestedTaskText: z.string().nullable().describe('The text of the suggested priority task, or null.'),
  reason: z.string().describe('The reasoning behind the suggestion, or why no specific suggestion was made.'),
  noSpecificSuggestion: z.boolean().describe('True if no specific task could be prioritized, false otherwise.'),
});
export type PrioritizeTasksOutput = z.infer<typeof PrioritizeTasksOutputSchema>;

export async function suggestPriorityTask(input: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  if (input.taskList.length === 0) {
    return {
      suggestedTaskId: null,
      suggestedTaskText: null,
      reason: "There are no pending tasks to prioritize.",
      noSpecificSuggestion: true,
    };
  }
  try {
    const result = await prioritizeTasksFlow(input);
    if (result.suggestedTaskId && !result.suggestedTaskText) {
      // Attempt to find the task text if AI only returned an ID
      const matchedTask = input.taskList.find(task => task.id === result.suggestedTaskId);
      if (matchedTask) {
        result.suggestedTaskText = matchedTask.text;
      } else {
        // If ID is invalid or not found, treat as no specific suggestion
        return {
          suggestedTaskId: null,
          suggestedTaskText: null,
          reason: "AI suggested a task ID that was not found in the provided list.",
          noSpecificSuggestion: true,
        };
      }
    }
    return result;
  } catch (error) {
    console.error("Error in suggestPriorityTask flow execution:", error);
    let errorMessage = "AI failed to process task prioritization.";
    if (error instanceof Error) errorMessage = error.message;
    return {
      suggestedTaskId: null,
      suggestedTaskText: null,
      reason: `Error during prioritization: ${errorMessage}`,
      noSpecificSuggestion: true,
    };
  }
}

const prioritizeTasksPrompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {schema: PrioritizeTasksInputSchema},
  output: {schema: PrioritizeTasksOutputSchema},
  prompt: `You are an expert task prioritization assistant.
Given a list of incomplete tasks and the current reference time (in UTC), your goal is to suggest the single most important or urgent task to focus on next.

Current Reference Time (ISO 8601 UTC): {{{referenceTimeISO}}}

List of Incomplete Tasks:
{{#if taskList.length}}
{{#each taskList}}
- Task ID: {{id}}
  Text: "{{text}}"
  Created At: {{createdAtISO}}
  {{#if dueAtISO}}Due At: {{dueAtISO}} ({{extractedTimeDescription}}){{else}}No specific due date{{/if}}
{{/each}}
{{else}}
No tasks provided.
{{/if}}

Prioritization Criteria (in order of importance):
1.  Urgency based on Due Date: Tasks due sooner are generally more important. Consider "today", "tomorrow", "within X hours".
2.  Keywords: Look for keywords like "urgent", "important", "deadline", "critical" in the task text.
3.  Task Age: Older tasks (based on createdAtISO) might need attention if not superseded by urgent or due tasks.
4.  Implicit Urgency: A task like "Prepare for 10 AM meeting" when it's 9 AM is highly urgent.

Instructions:
1.  Analyze all tasks based on the criteria above.
2.  Select the single task that you believe the user should focus on next.
3.  Provide the 'suggestedTaskId' and 'suggestedTaskText' for this task.
4.  Explain your choice in the 'reason' field (e.g., "This task is due today at 2 PM.", "Contains the keyword 'urgent'.", "This task was created 3 days ago and has no due date.").
5.  If all tasks seem equally important, or if there are no tasks, or if you genuinely cannot make a specific suggestion, set 'noSpecificSuggestion' to true, and 'suggestedTaskId' and 'suggestedTaskText' to null. Explain why in the 'reason' field (e.g., "All tasks have similar priority.", "No tasks to prioritize.").

Example:
Reference Time: 2024-07-30T09:00:00Z
Tasks:
- ID: 1, Text: "Call John about project", Created: 2024-07-29T10:00:00Z, Due: 2024-07-30T11:00:00Z (Today at 11 AM)
- ID: 2, Text: "Urgent: fix login bug", Created: 2024-07-30T08:00:00Z, Due: null
- ID: 3, Text: "Draft weekly report", Created: 2024-07-28T15:00:00Z, Due: 2024-08-02T17:00:00Z (Friday at 5 PM)

Output:
{
  "suggestedTaskId": "2",
  "suggestedTaskText": "Urgent: fix login bug",
  "reason": "This task contains the keyword 'Urgent' and was created recently, indicating high priority.",
  "noSpecificSuggestion": false
}
(Alternatively, task 1 could also be suggested if "Today at 11 AM" is deemed more critical than "Urgent" by the AI at that specific reference time)

Only return one suggested task. If there are no tasks, return 'noSpecificSuggestion: true'.
`,
});

const prioritizeTasksFlow = ai.defineFlow(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksInputSchema,
    outputSchema: PrioritizeTasksOutputSchema,
  },
  async (input) => {
    if (input.taskList.length === 0) {
        return {
            suggestedTaskId: null,
            suggestedTaskText: null,
            reason: "No tasks to prioritize.",
            noSpecificSuggestion: true,
        };
    }
    const {output} = await prioritizeTasksPrompt(input);
    if (!output) {
        console.error("prioritizeTasksPrompt returned undefined or null output");
        return {
            suggestedTaskId: null,
            suggestedTaskText: null,
            reason: "AI processing failed to return a valid suggestion structure.",
            noSpecificSuggestion: true,
        };
    }
    return output;
  }
);
