"use client";

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordButtonProps {
  onRecordingComplete: (audioDataUri: string) => Promise<void>;
  buttonText: string;
  processingText: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null | undefined;
  className?: string;
  idleIcon?: React.ReactNode;
  recordingIcon?: React.ReactNode;
}

export function RecordButton({
  onRecordingComplete,
  buttonText,
  processingText,
  variant = "default",
  className,
  idleIcon = <Mic className="mr-2 h-5 w-5" />,
  recordingIcon = <Square className="mr-2 h-5 w-5 animate-pulse text-destructive" />
}: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert Blob to Data URI
        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioDataUri = reader.result as string;
          setIsProcessing(true);
          try {
            await onRecordingComplete(audioDataUri);
          } catch (error) {
            console.error("Error processing recording:", error);
            toast({
              variant: "destructive",
              title: "Processing Error",
              description: "Failed to process your voice input. Please try again.",
            });
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Could not start recording. Please check microphone permissions.",
      });
    }
  }, [isRecording, onRecordingComplete, toast]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <Button
      onClick={toggleRecording}
      disabled={isProcessing}
      variant={variant}
      className={`w-full flex items-center justify-center transition-all duration-200 ease-in-out shadow-md hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-ring ${className}`}
      aria-live="polite"
      aria-label={isRecording ? "Stop recording" : buttonText}
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {processingText}
        </>
      ) : isRecording ? (
        <>
          {recordingIcon}
          Stop Recording
        </>
      ) : (
        <>
          {idleIcon}
          {buttonText}
        </>
      )}
    </Button>
  );
}
