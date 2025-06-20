
'use server';
/**
 * @fileOverview Extracts structured time information from task text.
 *
 * - extractTaskDetails - A function to parse task text for due dates/times.
 * - ExtractTaskDetailsInput - The input type for the extractTaskDetails function.
 * - ExtractTaskDetailsOutput - The return type for the extractTaskDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTaskDetailsInputSchema = z.object({
  taskText: z.string().describe('The raw text of the task.'),
  referenceTimeISO: z.string().describe('The current time in ISO 8601 format (UTC), to provide context for relative times like "tomorrow".')
});
export type ExtractTaskDetailsInput = z.infer<typeof ExtractTaskDetailsInputSchema>;

const ExtractTaskDetailsOutputSchema = z.object({
  parsedDueAtTimestamp: z.number().nullable().describe('The extracted due date/time as a Unix timestamp (milliseconds since epoch, UTC), or null if no specific time is found.'),
  extractedTimeDescription: z.string().nullable().describe('A human-friendly description of the extracted time (e.g., "Tomorrow at 2:00 PM"), or null if no time is found.'),
});
export type ExtractTaskDetailsOutput = z.infer<typeof ExtractTaskDetailsOutputSchema>;

export async function extractTaskDetails(input: ExtractTaskDetailsInput): Promise<ExtractTaskDetailsOutput> {
  return extractTaskDetailsFlow(input);
}

const extractTaskDetailsPrompt = ai.definePrompt({
  name: 'extractTaskDetailsPrompt',
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
        For example, if the current reference time is 2024-07-28T10:00:00Z and the task is "meeting tomorrow at 2pm", the ISO string should represent 2024-07-29T14:00:00Z (assuming "2pm" is interpreted in a common local sense relative to the reference day and then anchored to UTC).
    -   Provide a human-friendly description of this extracted time (e.g., "Tomorrow at 2:00 PM", "July 29th, 2:00 PM").
3.  If no specific due date/time is found, or if it's too vague (e.g., "sometime next week" without a day), return null for both the timestamp and the description.
    -   A task like "buy groceries" has no specific time.
    -   A task "finish report soon" is too vague.

Output Format:
Return a JSON object with 'parsedDueAtTimestamp' (Unix timestamp in milliseconds UTC, or null) and 'extractedTimeDescription' (string, or null).
To get the Unix timestamp in milliseconds, first derive the full ISO 8601 UTC string, then convert that to milliseconds since epoch.

Examples based on referenceTimeISO = 2024-07-28T10:00:00Z:
-   Task: "Team meeting tomorrow at 3 PM"
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-29T15:00:00Z), "extractedTimeDescription": "Tomorrow at 3:00 PM" }
-   Task: "Submit report by July 30th 5pm"
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-30T17:00:00Z), "extractedTimeDescription": "July 30th at 5:00 PM" }
-   Task: "Call John in 2 hours"
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-28T12:00:00Z), "extractedTimeDescription": "In 2 hours (around 12:00 PM UTC)" }
-   Task: "Pick up dry cleaning"
    Output: { "parsedDueAtTimestamp": null, "extractedTimeDescription": null }
-   Task: "Project deadline is next Friday" (assuming 'next Friday' means the Friday of the following week)
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-08-02T17:00:00Z assuming end of business day), "extractedTimeDescription": "Next Friday (August 2nd, end of day)" }
-   Task: "Doctor's appointment at 9 AM" (if 9 AM today has passed, assume tomorrow 9 AM)
    Output: { "parsedDueAtTimestamp": (timestamp for 2024-07-29T09:00:00Z), "extractedTimeDescription": "Tomorrow at 9:00 AM" }

Be precise with calculations.
`,
});

const extractTaskDetailsFlow = ai.defineFlow(
  {
    name: 'extractTaskDetailsFlow',
    inputSchema: ExtractTaskDetailsInputSchema,
    outputSchema: ExtractTaskDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await extractTaskDetailsPrompt(input);
    // The LLM is asked to return a timestamp, but if it returns an ISO string, we might need to parse it here.
    // For now, we trust the schema and direct output.
    // The prompt guides the LLM to calculate the timestamp.
    return output!;
  }
);
