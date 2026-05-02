import { useState, useEffect, useRef, useCallback } from 'react';
import { recordTTSFallback } from '../utils/metrics';

const ttsCache = new Map();

const getCacheKey = (personality, text) => {
  return `${personality}:${text.trim().toLowerCase()}`;
};

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

  // Pre-load "please wait" prompts
  useEffect(() => {
    const prompts = [
      { p: 'Jenny', t: 'One moment, I am thinking.' },
      { p: 'Gabby', t: 'Gabby is thinking, give her a second!' }
    ];
    prompts.forEach(async ({ p, t }) => {
      const key = getCacheKey(p, t);
      if (!ttsCache.has(key)) {
        try {
          const voiceModel = p === 'Jenny' ? 'aura-stella-en' : 'aura-orion-en';
          const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: t })
          });
          if (response.ok) {
            const blob = await response.blob();
            ttsCache.set(key, URL.createObjectURL(blob));
          }
        } catch (e) {}
      }
    });
  }, [apiKey]);

  const startListening = useCallback(async () => {
    if (isListening || socketRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket('wss://api.deepgram.com/v1/listen', ['token', apiKey]);

      socket.onopen = () => {
        console.log('Deepgram WebSocket opened');
        setStatus('Listening...');
        setIsListening(true);
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        });
        mediaRecorder.start(100); 
        mediaRecorderRef.current = mediaRecorder;
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript && received.is_final) {
          currentTranscriptRef.current += ' ' + transcript;
          onTranscript(currentTranscriptRef.current.trim(), true);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (currentTranscriptRef.current.trim()) {
              const finalTranscript = currentTranscriptRef.current.trim();
              currentTranscriptRef.current = ''; // Clear BEFORE callback to avoid race
              onTranscript(finalTranscript, 'silence');
            }
          }, silenceThreshold);
        }
      };

      socket.onerror = (err) => {
        console.error('Deepgram WebSocket error:', err);
        setStatus('Error');
      };

      socket.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);
        setIsListening(false);
        setStatus('Ready');
        socketRef.current = null;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      };
      socketRef.current = socket;
    } catch (err) {
      console.error('Failed to start listening:', err);
      setStatus('Error');
      setIsListening(false);
      socketRef.current = null;
    }
  }, [apiKey, isListening, onTranscript, silenceThreshold]);

  const stopListening = useCallback(() => {
    console.log('Stopping Deepgram listening...');
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    if (socketRef.current) {
      // Remove onclose listener to prevent state flip-flopping during intentional close
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setIsListening(false);
    setStatus('Ready');
    currentTranscriptRef.current = '';
  }, []);

  const speak = useCallback(async (text, personality = 'Jenny') => {
    if (!text) return;
    const cacheKey = getCacheKey(personality, text);
    
    if (ttsCache.has(cacheKey)) {
      const url = ttsCache.get(cacheKey);
      return playAudio(url);
    }

    let fallbackPlayed = false;
    const fallbackTimeout = setTimeout(() => {
      const fallbackText = personality === 'Jenny' ? 'One moment, I am thinking.' : 'Gabby is thinking, give her a second!';
      const fallbackUrl = ttsCache.get(getCacheKey(personality, fallbackText));
      if (fallbackUrl) {
        recordTTSFallback();
        playAudio(fallbackUrl);
        fallbackPlayed = true;
      }
    }, 3000);

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

      clearTimeout(fallbackTimeout);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        ttsCache.set(cacheKey, url);
        if (!fallbackPlayed) {
          return playAudio(url);
        }
      }
    } catch (err) {
      clearTimeout(fallbackTimeout);
      console.error('TTS Error:', err);
    }
  }, [apiKey]);

  const playAudio = (url) => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onplay = () => setStatus('Speaking...');
      audio.onended = () => {
        setStatus('Ready');
        resolve();
      };
      audio.play();
    });
  };

  return { isListening, status, startListening, stopListening, speak };
};
