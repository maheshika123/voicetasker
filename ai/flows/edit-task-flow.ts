
'use server';
/**
 * @fileOverview Edits an existing task based on a voice command.
 *
 * - editTaskFlow - A function to process voice commands for editing task text and/or due time.
 * - EditTaskInput - The input type for the editTaskFlow function.
 * - EditTaskOutput - The return type for the editTaskFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EditTaskInputSchema = z.object({
  voiceCommand: z.string().describe('The transcribed voice command from the user.'),
  currentTaskText: z.string().describe('The current text of the task being edited.'),
  currentTaskDueAtISO: z.string().nullable().describe('The current due date/time of the task in ISO 8601 format (UTC), if any.'),
  currentTaskExtractedTimeDescription: z.string().nullable().describe('The current human-friendly description of the due time, if any.'),
  referenceTimeISO: z.string().describe('The current time in ISO 8601 format (UTC), to provide context for relative times like "tomorrow".')
});
export type EditTaskInput = z.infer<typeof EditTaskInputSchema>;

const EditTaskOutputSchema = z.object({
  updatedTaskText: z.string().describe('The full, updated text of the task. If the text was not meant to be changed, this should be the same as currentTaskText.'),
  newDueAtTimestamp: z.number().nullable().describe('The new due date/time as a Unix timestamp (milliseconds since epoch, UTC), or null if no specific time is set or found. If the time was not meant to be changed, this reflects the original due time or null.'),
  newExtractedTimeDescription: z.string().nullable().describe('A human-friendly description of the new extracted time (e.g., "Tomorrow at 2:00 PM"), or null if no time is set or found. If the time was not meant to be changed, this reflects the original description or null.'),
  changeSummary: z.string().describe('A brief summary of the changes made, e.g., "Task text updated." or "Due time changed to tomorrow at 5 PM." or "Task text and due time updated."'),
  noChangesMade: z.boolean().describe('True if the AI determines no actual changes were requested by the voice command, otherwise false.'),
});
export type EditTaskOutput = z.infer<typeof EditTaskOutputSchema>;

export async function editTask(input: EditTaskInput): Promise<EditTaskOutput> {
  try {
    return await editTaskFlow(input);
  } catch (error) {
    console.error("Error in editTask flow execution:", error);
    let errorMessage = "AI failed to process edit command.";
    if (error instanceof Error) errorMessage = error.message;
    // Fallback to a "no changes made" response with error details in summary
    return {
      updatedTaskText: input.currentTaskText,
      newDueAtTimestamp: input.currentTaskDueAtISO ? new Date(input.currentTaskDueAtISO).getTime() : null,
      newExtractedTimeDescription: input.currentTaskExtractedTimeDescription,
      changeSummary: `Error processing edit: ${errorMessage}`,
      noChangesMade: true,
    };
  }
}

const editTaskPrompt = ai.definePrompt({
  name: 'editTaskPrompt',
  input: {schema: EditTaskInputSchema},
  output: {schema: EditTaskOutputSchema},
  prompt: `You are an intelligent task editing assistant.
The user wants to edit an existing task using a voice command.
Your goal is to understand the intent of the voice command and update the task's text and/or its due date/time accordingly.

Current Reference Time (ISO 8601 UTC): {{{referenceTimeISO}}}

Existing Task Details:
- Current Text: "{{currentTaskText}}"
- Current Due Time (ISO 8601 UTC, if any): {{{currentTaskDueAtISO}}}
- Current Due Time Description (if any): {{{currentTaskExtractedTimeDescription}}}

User's Voice Command for Editing: "{{voiceCommand}}"

Instructions:
1.  Analyze the Voice Command: Determine if the user wants to:
    a.  Change the task text only.
    b.  Change the due date/time only.
    c.  Change both the task text and the due date/time.
    d.  Make no changes (e.g., command is unclear, irrelevant, or confirms no change).

2.  Update Task Text:
    -   If the command implies a change to the task's text, formulate the *complete new task text*.
    -   If no change to text is implied, 'updatedTaskText' should be the 'currentTaskText'.

3.  Update Due Date/Time:
    -   If the command implies a change to the due date/time (e.g., "reschedule to tomorrow 3pm", "set due date for Friday", "remove due date"):
        -   Parse the new date/time based on the 'voiceCommand' and 'referenceTimeISO'.
        -   Convert this new date/time into an absolute ISO 8601 timestamp string (e.g., "YYYY-MM-DDTHH:mm:ss.sssZ") in UTC. Then convert this ISO string to a Unix timestamp in milliseconds. This will be 'newDueAtTimestamp'.
        -   Provide a human-friendly description for this new time (e.g., "Tomorrow at 3:00 PM"). This will be 'newExtractedTimeDescription'.
        -   If the command is to *remove* the due date, set 'newDueAtTimestamp' and 'newExtractedTimeDescription' to null.
    -   If no change to the due date/time is implied, 'newDueAtTimestamp' should be derived from 'currentTaskDueAtISO' (or null if 'currentTaskDueAtISO' is null), and 'newExtractedTimeDescription' should be 'currentTaskExtractedTimeDescription' (or null).

4.  Change Summary:
    -   Provide a concise 'changeSummary' describing what was updated (e.g., "Task text updated.", "Due time changed to next Monday.", "Task text and due time updated.", "Due date removed.").
    -   If no changes were made or intended, 'changeSummary' should reflect that (e.g., "No changes detected in the command.").

5.  No Changes Flag:
    -   Set 'noChangesMade' to 'true' if you determine the voice command did not intend to make any modifications to the task's text or due time, or if the command was too vague to interpret as an edit. Otherwise, set it to 'false'.

Examples (referenceTimeISO = 2024-07-29T10:00:00Z):

-   Current Task: { text: "Buy groceries", dueAtISO: "2024-07-30T17:00:00Z", extractedTimeDescription: "Tomorrow at 5:00 PM" }
    Voice Command: "Change 'Buy groceries' to 'Buy party supplies'"
    Output: { updatedTaskText: "Buy party supplies", newDueAtTimestamp: (timestamp for 2024-07-30T17:00:00Z), newExtractedTimeDescription: "Tomorrow at 5:00 PM", changeSummary: "Task text updated.", noChangesMade: false }

-   Current Task: { text: "Team meeting", dueAtISO: "2024-07-29T14:00:00Z", extractedTimeDescription: "Today at 2:00 PM" }
    Voice Command: "Reschedule team meeting to tomorrow at 3pm"
    Output: { updatedTaskText: "Team meeting", newDueAtTimestamp: (timestamp for 2024-07-30T15:00:00Z), newExtractedTimeDescription: "Tomorrow at 3:00 PM", changeSummary: "Due time changed to tomorrow at 3:00 PM.", noChangesMade: false }

-   Current Task: { text: "Submit report", dueAtISO: null, extractedTimeDescription: null }
    Voice Command: "Make that 'Submit final report' and set it for Friday evening"
    Output: { updatedTaskText: "Submit final report", newDueAtTimestamp: (timestamp for 2024-08-02T17:00:00Z assuming end of day), newExtractedTimeDescription: "Friday evening (August 2nd)", changeSummary: "Task text and due time updated.", noChangesMade: false }

-   Current Task: { text: "Call John", dueAtISO: "2024-07-29T11:00:00Z", extractedTimeDescription: "Today at 11:00 AM"}
    Voice Command: "Actually, never mind about John's call" (Interpreted as no change to this specific task)
    Output: { updatedTaskText: "Call John", newDueAtTimestamp: (timestamp for 2024-07-29T11:00:00Z), newExtractedTimeDescription: "Today at 11:00 AM", changeSummary: "No changes detected for this task.", noChangesMade: true }

-   Current Task: { text: "Project update", dueAtISO: "2024-08-05T10:00:00Z", extractedTimeDescription: "Next Monday at 10:00 AM"}
    Voice Command: "Remove the due date for project update"
    Output: { updatedTaskText: "Project update", newDueAtTimestamp: null, newExtractedTimeDescription: null, changeSummary: "Due date removed.", noChangesMade: false }

Return the full updated task text and time details, not just the diffs.
Be precise with date and time calculations.
If the voice command is vague or doesn't seem to relate to editing the task, err on the side of 'noChangesMade: true'.
`,
});

const editTaskFlow = ai.defineFlow(
  {
    name: 'editTaskFlow',
    inputSchema: EditTaskInputSchema,
    outputSchema: EditTaskOutputSchema,
  },
  async (input) => {
    const {output} = await editTaskPrompt(input);
    if (!output) {
        // This case should ideally be handled by Zod schema validation if output is null
        // or if the LLM returns something not conforming to EditTaskOutputSchema.
        // However, as a fallback:
        console.error("editTaskPrompt returned undefined or null output");
        return {
            updatedTaskText: input.currentTaskText,
            newDueAtTimestamp: input.currentTaskDueAtISO ? new Date(input.currentTaskDueAtISO).getTime() : null,
            newExtractedTimeDescription: input.currentTaskExtractedTimeDescription,
            changeSummary: "AI processing failed to return a valid structure.",
            noChangesMade: true,
        };
    }
    return output;
  }
);

