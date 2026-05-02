import { useState, useEffect, useRef, useCallback } from 'react';

export const useSilenceDetection = (onSilenceDetected, options = {}) => {
  const { duration = 3500 } = options;
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    setIsRecording(false);
    mediaRecorderRef.current.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('Browser does not support audio capture');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        if (onSilenceDetected) {
          const uri = URL.createObjectURL(blob);
          onSilenceDetected(uri);
        }
        cleanupStream();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, duration);
    } catch (err) {
      console.error('Failed to start recording', err);
      cleanupStream();
    }
  }, [duration, onSilenceDetected, stopRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      cleanupStream();
    };
  }, []);

  return { isRecording, startRecording, stopRecording };
};
