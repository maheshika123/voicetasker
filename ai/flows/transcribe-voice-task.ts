'use server';
/**
 * @fileOverview Converts voice input to text for task creation.
 *
 * - transcribeVoiceTask - A function to transcribe voice to text and add it to the to-do list.
 * - TranscribeVoiceTaskInput - The input type for the transcribeVoiceTask function.
 * - TranscribeVoiceTaskOutput - The return type for the transcribeVoiceTask function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeVoiceTaskInputSchema = z.object({
  voiceDataUri: z
    .string()
    .describe(
      "The voice data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeVoiceTaskInput = z.infer<typeof TranscribeVoiceTaskInputSchema>;

const TranscribeVoiceTaskOutputSchema = z.object({
  transcribedText: z.string().describe('The transcribed text from the voice input.'),
});
export type TranscribeVoiceTaskOutput = z.infer<typeof TranscribeVoiceTaskOutputSchema>;

export async function transcribeVoiceTask(input: TranscribeVoiceTaskInput): Promise<TranscribeVoiceTaskOutput> {
  return transcribeVoiceTaskFlow(input);
}

const transcribeVoiceTaskPrompt = ai.definePrompt({
  name: 'transcribeVoiceTaskPrompt',
  input: {schema: TranscribeVoiceTaskInputSchema},
  output: {schema: TranscribeVoiceTaskOutputSchema},
  prompt: `Transcribe the following voice recording to text:\n\n{{media url=voiceDataUri}}`,
});

const transcribeVoiceTaskFlow = ai.defineFlow(
  {
    name: 'transcribeVoiceTaskFlow',
    inputSchema: TranscribeVoiceTaskInputSchema,
    outputSchema: TranscribeVoiceTaskOutputSchema,
  },
  async input => {
    const {output} = await transcribeVoiceTaskPrompt(input);
    return output!;
  }
);
