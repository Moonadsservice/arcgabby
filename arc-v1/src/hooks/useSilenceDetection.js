import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useARC } from '../context/ARCContext';

export const useSilenceDetection = (onSilenceDetected, options = {}) => {
  const { threshold = -45, duration = 3500 } = options;
  const lastSpeakTimeRef = useRef(0);
  const recordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };

      const { recording } = await Audio.Recording.createAsync(
        recordingOptions,
        (status) => {
          if (!status.canRecord || !status.isRecording) return;

          const now = Date.now();
          const metering = status.metering || -160;

          if (metering > threshold) {
            lastSpeakTimeRef.current = now;
          } else if (lastSpeakTimeRef.current > 0 && now - lastSpeakTimeRef.current > duration) {
            stopRecording();
          }
        },
        100
      );

      recordingRef.current = recording;
      setIsRecording(true);
      lastSpeakTimeRef.current = Date.now();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }, [onSilenceDetected, threshold, duration]);

  const stopRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;
      
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (uri) {
        onSilenceDetected(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }, [onSilenceDetected]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  return { isRecording, startRecording, stopRecording };
};
