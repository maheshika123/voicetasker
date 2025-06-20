
'use server';
/**
 * @fileOverview Analyzes a new voice command against existing tasks to determine if it's a new task or an update to an existing one.
 *
 * - disambiguateTaskIntent - Main function to process the disambiguation.
 * - DisambiguateTaskIntentInput - Input type for the flow.
 * - DisambiguateTaskIntentOutput - Output type for the flow.
 * - FlowTaskBrief - Simplified task structure for input.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Simplified task structure for the input list of existing tasks
const FlowTaskBriefSchema = z.object({
  id: z.string(),
  text: z.string(),
  dueAtISO: z.string().nullable().describe("Existing task due date in ISO 8601 format (UTC), if any."),
  extractedTimeDescription: z.string().nullable().describe("Existing human-friendly description of the due time, if any."),
});
export type FlowTaskBrief = z.infer<typeof FlowTaskBriefSchema>;

const DisambiguateTaskIntentInputSchema = z.object({
  voiceCommandText: z.string().describe('The transcribed text of the new voice command.'),
  existingTasks: z.array(FlowTaskBriefSchema).describe('A list of current incomplete tasks.'),
  referenceTimeISO: z.string().describe('The current time in ISO 8601 format (UTC), for parsing new times.'),
});
export type DisambiguateTaskIntentInput = z.infer<typeof DisambiguateTaskIntentInputSchema>;

const DisambiguateTaskIntentOutputSchema = z.object({
  isPotentialEdit: z.boolean().describe('True if the command is likely an edit/addition to an existing task.'),
  matchedTaskId: z.string().nullable().describe('The ID of the existing task if isPotentialEdit is true.'),
  proposedTaskText: z.string().describe('The full text the AI believes the user intends for the task (new or edited).'),
  proposedDueAtTimestamp: z.number().nullable().describe('The due time (Unix timestamp, ms, UTC) for this proposed task, or null.'),
  proposedExtractedTimeDescription: z.string().nullable().describe('A human-readable version of the proposed due time, or null.'),
  reasonForSuggestion: z.string().describe('AI\'s brief explanation for its decision (e.g., "This seems to update task X...").'),
});
export type DisambiguateTaskIntentOutput = z.infer<typeof DisambiguateTaskIntentOutputSchema>;

export async function disambiguateTaskIntent(input: DisambiguateTaskIntentInput): Promise<DisambiguateTaskIntentOutput> {
  try {
    return await disambiguateTaskIntentFlow(input);
  } catch (error) {
    console.error("Error in disambiguateTaskIntent flow:", error);
    // Fallback: treat as a new task, attempt basic time extraction from original command
    const basicTimeExtraction = await ai.generate({
        prompt: `Extract date and time from this text: "${input.voiceCommandText}". Reference time: ${input.referenceTimeISO}. Output should be a future ISO 8601 UTC timestamp or null if no time is found. Also give a human-readable string for the time.`,
        output: {
            schema: z.object({
                timestamp: z.string().nullable(),
                description: z.string().nullable(),
            })
        }
    });
    const dueAt = basicTimeExtraction.output?.timestamp ? new Date(basicTimeExtraction.output.timestamp).getTime() : null;

    return {
      isPotentialEdit: false,
      matchedTaskId: null,
      proposedTaskText: input.voiceCommandText,
      proposedDueAtTimestamp: dueAt,
      proposedExtractedTimeDescription: basicTimeExtraction.output?.description || null,
      reasonForSuggestion: 'Error in advanced processing; treated as a new task.',
    };
  }
}

const disambiguatePrompt = ai.definePrompt({
  name: 'disambiguateTaskIntentPrompt',
  input: {schema: DisambiguateTaskIntentInputSchema},
  output: {schema: DisambiguateTaskIntentOutputSchema},
  prompt: `You are an intelligent task assistant. Your goal is to determine if a new voice command is for a brand new task or an attempt to update/add details to an existing one.

Current Reference Time (ISO 8601 UTC): {{{referenceTimeISO}}}
User's new voice command: "{{voiceCommandText}}"

List of existing incomplete tasks:
{{#if existingTasks.length}}
{{#each existingTasks}}
- Task ID: {{id}}
  Text: "{{text}}"
  {{#if dueAtISO}}Current Due: {{dueAtISO}} ({{extractedTimeDescription}}){{else}}No current due date{{/if}}
{{/each}}
{{else}}
(No existing tasks)
{{/if}}

Instructions:

1.  Analyze the "{{voiceCommandText}}".
2.  Compare it against each task in "List of existing incomplete tasks".
3.  **Decision Point:**
    *   **If the voice command seems to clearly modify, update, or add details to ONE of the existing tasks:**
        *   Set \`isPotentialEdit\` to \`true\`.
        *   Set \`matchedTaskId\` to the ID of that specific existing task.
        *   Formulate the \`proposedTaskText\`. This should be the *complete, updated text* for the task, incorporating the user's new command with the existing task's content. For example, if an existing task is "Go to temple at 5" and the voice command is "After temple, go to supermarket", the \`proposedTaskText\` should be something like "Go to temple at 5, then go to supermarket".
        *   Extract any new due date/time from "{{voiceCommandText}}" relative to "{{referenceTimeISO}}".
            *   If the command specifies a new time, use it for \`proposedDueAtTimestamp\` (Unix ms UTC) and \`proposedExtractedTimeDescription\`.
            *   If the command *changes text but doesn't mention a new time*, and the matched existing task *had* a due time, generally *preserve* the existing due time.
            *   If the command explicitly removes or implies removal of a due time (e.g., "clear the due date"), set time fields to null.
            *   If no time is mentioned and the original task had no time, keep time fields null.
        *   Provide a concise \`reasonForSuggestion\`, e.g., "This command appears to add details to your task about 'going to the temple'."
    *   **If the voice command seems to be for a completely new task (not a strong match or clear update to any existing task):**
        *   Set \`isPotentialEdit\` to \`false\`.
        *   Set \`matchedTaskId\` to \`null\`.
        *   Set \`proposedTaskText\` based on "{{voiceCommandText}}" (it can be the command text itself, or a slightly refined version if appropriate for a task).
        *   Extract any due date/time from "{{voiceCommandText}}" relative to "{{referenceTimeISO}}" for \`proposedDueAtTimestamp\` and \`proposedExtractedTimeDescription\`.
        *   Provide a \`reasonForSuggestion\`, e.g., "This appears to be a new task."

4.  **Time Extraction:**
    *   When extracting time, calculate the absolute Unix timestamp in milliseconds (UTC) for \`proposedDueAtTimestamp\`.
    *   \`proposedExtractedTimeDescription\` should be a user-friendly string like "Tomorrow at 3 PM".

Example Scenario:
Reference Time: 2024-08-01T10:00:00Z
Existing Task: { id: "123", text: "Go to temple at 5 in the evening", dueAtISO: "2024-08-01T17:00:00Z", extractedTimeDescription: "Today at 5:00 PM" }
Voice Command: "After going to the temple at 5, I need to go to the supermarket."

Expected Output (example):
{
  "isPotentialEdit": true,
  "matchedTaskId": "123",
  "proposedTaskText": "Go to temple at 5 in the evening, then go to the supermarket.",
  "proposedDueAtTimestamp": (timestamp for 2024-08-01T17:00:00Z), // Time preserved as command implies sequence
  "proposedExtractedTimeDescription": "Today at 5:00 PM",
  "reasonForSuggestion": "The command adds a follow-up action to the existing 'temple' task."
}

If the voice command was "Book flight to Paris for next week", and no similar tasks exist:
Expected Output (example):
{
  "isPotentialEdit": false,
  "matchedTaskId": null,
  "proposedTaskText": "Book flight to Paris for next week",
  "proposedDueAtTimestamp": (timestamp for e.g. 2024-08-08T17:00:00Z, assuming end of day for "next week"),
  "proposedExtractedTimeDescription": "Next Thursday (August 8th, end of day)",
  "reasonForSuggestion": "This appears to be a new task about booking a flight."
}

Ensure all output fields are populated according to the schema.
If 'existingTasks' is empty, always treat the command as a new task.
`,
});

const disambiguateTaskIntentFlow = ai.defineFlow(
  {
    name: 'disambiguateTaskIntentFlow',
    inputSchema: DisambiguateTaskIntentInputSchema,
    outputSchema: DisambiguateTaskIntentOutputSchema,
  },
  async (input) => {
    // If no existing tasks, it's definitely a new task.
    // We still need to parse the text and time for the new task.
    if (!input.existingTasks || input.existingTasks.length === 0) {
        const timeDetails = await extractTaskDetails({
            taskText: input.voiceCommandText,
            referenceTimeISO: input.referenceTimeISO,
        });
        return {
            isPotentialEdit: false,
            matchedTaskId: null,
            proposedTaskText: input.voiceCommandText,
            proposedDueAtTimestamp: timeDetails.parsedDueAtTimestamp,
            proposedExtractedTimeDescription: timeDetails.extractedTimeDescription,
            reasonForSuggestion: "No existing tasks; treated as new.",
        };
    }

    const {output} = await disambiguatePrompt(input);
    if (!output) {
        // Fallback if AI fails to produce structured output
        console.error("Disambiguation prompt returned undefined or null output");
        const timeDetails = await extractTaskDetails({
            taskText: input.voiceCommandText,
            referenceTimeISO: input.referenceTimeISO,
        });
        return {
            isPotentialEdit: false,
            matchedTaskId: null,
            proposedTaskText: input.voiceCommandText,
            proposedDueAtTimestamp: timeDetails.parsedDueAtTimestamp,
            proposedExtractedTimeDescription: timeDetails.extractedTimeDescription,
            reasonForSuggestion: "AI processing failed; treated as new task by fallback.",
        };
    }
    return output;
  }
);

// Helper flow (could be part of this file or imported if extract-task-details.ts is kept separate)
// For simplicity, I'm assuming extractTaskDetails is available or its logic integrated here.
// If extract-task-details.ts is used, ensure its Zod schemas are compatible or handled.

const ExtractTaskDetailsInputSchema = z.object({
  taskText: z.string().describe('The raw text of the task.'),
  referenceTimeISO: z.string().describe('The current time in ISO 8601 format (UTC), to provide context for relative times like "tomorrow".')
});
const ExtractTaskDetailsOutputSchema = z.object({
  parsedDueAtTimestamp: z.number().nullable().describe('The extracted due date/time as a Unix timestamp (milliseconds since epoch, UTC), or null if no specific time is found.'),
  extractedTimeDescription: z.string().nullable().describe('A human-friendly description of the extracted time (e.g., "Tomorrow at 2:00 PM"), or null if no time is found.'),
});

const extractTaskDetailsPrompt = ai.definePrompt({
  name: 'internalExtractTaskDetailsPromptForDisambiguation', // Unique name
  input: {schema: ExtractTaskDetailsInputSchema},
  output: {schema: ExtractTaskDetailsOutputSchema},
  prompt: `You are a task parsing assistant. Given a task description and the current reference time (in UTC), your goal is to extract any specific due date and time.

Current Reference Time (ISO 8601 UTC): {{{referenceTimeISO}}}
Task Description: {{{taskText}}}

Your tasks:
1.  Identify if the task description contains a specific due date and/or time.
    -   Consider phrases like "today", "tomorrow", "next week", "in X hours/minutes", specific dates like "July 30th", "on Monday", and times like "at 5pm", "by 2:30".
2.  If a date and time is found:
    -   Convert this found date/time into an absolute ISO 8601 timestamp string (e.g., "YYYY-MM-DDTHH:mm:ss.sssZ"). Ensure this timestamp is in UTC.
    -   Convert the ISO string to a Unix timestamp in milliseconds. This is 'parsedDueAtTimestamp'.
    -   Provide a human-friendly description of this extracted time (e.g., "Tomorrow at 2:00 PM", "July 29th, 2:00 PM"). This is 'extractedTimeDescription'.
3.  If no specific due date/time is found, or if it's too vague (e.g., "sometime next week" without a day), return null for both the timestamp and the description.

Examples based on referenceTimeISO = 2024-07-28T10:00:00Z:
-   Task: "Team meeting tomorrow at 3 PM"
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-29T15:00:00Z), "extractedTimeDescription": "Tomorrow at 3:00 PM" }
-   Task: "Call John in 2 hours"
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-28T12:00:00Z), "extractedTimeDescription": "In 2 hours (around 12:00 PM UTC)" }
-   Task: "Pick up dry cleaning"
    Output: { "parsedDueAtTimestamp": null, "extractedTimeDescription": null }
`,
});

const extractTaskDetails = ai.defineFlow(
  {
    name: 'internalExtractTaskDetailsFlowForDisambiguation', // Unique name
    inputSchema: ExtractTaskDetailsInputSchema,
    outputSchema: ExtractTaskDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await extractTaskDetailsPrompt(input);
    return output!;
  }
);
