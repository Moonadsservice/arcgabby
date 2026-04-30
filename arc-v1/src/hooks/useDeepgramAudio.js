import { useState, useEffect, useRef, useCallback } from 'react';

export const useDeepgramAudio = (onTranscript, options = {}) => {
  const { 
    apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY,
    silenceThreshold = 2500, // 2.5 seconds of silence
    model = 'nova-2',
    language = 'en-US'
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Ready');
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const currentTranscriptRef = useRef('');

  const startListening = useCallback(async () => {
    if (isListening) return;
    console.log('Deepgram: Initializing stream and socket...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize Deepgram WebSocket
      const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
        'token',
        apiKey,
      ]);

      socket.onopen = () => {
        console.log('Deepgram: WebSocket connection established');
        setStatus('Listening...');
        setIsListening(true);
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && socket.readyState === 1) {
            socket.send(event.data);
          }
        });
        mediaRecorder.start(250); // Send chunks every 250ms
        mediaRecorderRef.current = mediaRecorder;
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;

        if (transcript && received.is_final) {
          console.log('Deepgram: Transcript received:', transcript);
          currentTranscriptRef.current += ' ' + transcript;
          onTranscript(currentTranscriptRef.current.trim(), true);
          
          // Reset silence timer whenever we get a transcript
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (currentTranscriptRef.current.trim()) {
              console.log('Deepgram: Silence detected, triggering processing');
              onTranscript(currentTranscriptRef.current.trim(), 'silence');
              currentTranscriptRef.current = '';
            }
          }, silenceThreshold);
        }
      };

      socket.onerror = (err) => {
        console.error('Deepgram WebSocket Error:', err);
        setStatus('Error');
      };

      socket.onclose = () => {
        console.log('Deepgram: WebSocket connection closed');
        setIsListening(false);
        setStatus('Ready');
      };

      socketRef.current = socket;
    } catch (err) {
      console.error('Failed to start Deepgram STT:', err);
      setStatus('Error');
    }
  }, [apiKey, isListening, onTranscript, silenceThreshold]);

  const stopListening = useCallback(() => {
    console.log('Deepgram: Manually stopping listening...');
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setIsListening(false);
    setStatus('Ready');
  }, []);

  const speak = useCallback(async (text, personality = 'Jenny') => {
    if (!text) return;

    try {
      const voiceModel = personality === 'Jenny' ? 'aura-stella-en' : 'aura-orion-en';
      const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        return new Promise((resolve) => {
          audio.onplay = () => setStatus('Speaking...');
          audio.onended = () => {
            setStatus('Ready');
            resolve();
          };
          audio.play();
        });
      }
    } catch (err) {
      console.error('Deepgram TTS Error:', err);
    }
  }, [apiKey]);

  return { isListening, status, startListening, stopListening, speak };
};
