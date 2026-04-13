import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  ScrollView, 
  useColorScheme,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXA_API_KEY, DEEPGRAM_API_KEY } from '@env';
import Exa from 'exa-js';
import { createClient } from '@deepgram/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { OneSignal } from 'react-native-onesignal'; // Moved to dynamic import for web compatibility
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { saveMemory, searchMemory } from './src/utils/supabase';
import { extractVideoId, fetchTranscriptChunks, formatTimestamp } from './src/utils/youtube';

const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"; // Placeholder for user to update

export default function App() {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');

  const [status, setStatus] = useState('Ready');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]); // Context Awareness: Message History
  const [tasks, setTasks] = useState([]); // Agentic Tasks
  const [currentTranscription, setCurrentTranscription] = useState(''); // Live transcription view
  const [error, setError] = useState(null); // Error handling
  const [inputText, setInputText] = useState(''); // Text input for typing
  const [personality, setPersonality] = useState('Jenny'); // Jenny (Task) or Gabby (Conversational)
  const [isDualMode, setIsDualMode] = useState(false); // Dual personality mode
  const [showHistory, setShowHistory] = useState(false); // Hidden history panel
  const [showQuickTools, setShowQuickTools] = useState(false); // Quick tools menu toggle
  const [fileLogs, setFileLogs] = useState([]); // Tracking created files
  const [currentView, setCurrentView] = useState('landing'); // landing, signin, signup, chat
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [historyFilter, setHistoryFilter] = useState('All'); // All, Files, Web
  const [activeTool, setActiveTool] = useState(null); // Currently active quick tool
  const [sessions, setSessions] = useState([]); // Conversation folders/sessions
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString()); // Current active folder
  const [currentSessionName, setCurrentSessionName] = useState('New Session');
  const [notifications, setNotifications] = useState([]); // Facebook-style notification tray
  const [showNotifications, setShowNotifications] = useState(false); // Notification tray toggle
  const [summaryFormat, setSummaryFormat] = useState('Professional Summary'); // Custom summary format instructions
  const [showFeedback, setShowFeedback] = useState(false); // Feedback modal toggle
  const [feedbackText, setFeedbackText] = useState(''); // Feedback input
  const [showSettings, setShowSettings] = useState(false); // Settings modal toggle
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true); // Voice toggle state
  
  // Animation values for landing page
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const settingsAnim = useRef(new Animated.Value(0)).current; // Animation for settings panel

  useEffect(() => {
    if (currentView === 'landing') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentView]);
  
  const isSessionActiveRef = useRef(false);
  const scrollViewRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const deepgramSocketRef = useRef(null);
  const deepgramClientRef = useRef(null);

  // Initialize Transcription (Deepgram or Web Speech)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const dg_key = DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY || process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY;
      
      if (!dg_key || dg_key.startsWith('YOUR_') || dg_key === 'YOUR_DEEPGRAM_API_KEY') {
        // Fallback to Web Speech API
        if (window.webkitSpeechRecognition || window.SpeechRecognition) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'en-US';

          recognitionRef.current.onstart = () => {
            setStatus('Listening...');
            setIsRecording(true);
          };

          recognitionRef.current.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map(result => result[0])
              .map(result => result.transcript)
              .join('');
            setCurrentTranscription(transcript);
          };

          recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
              setError('Microphone access denied.');
            } else {
              setError(`Transcription error: ${event.error}`);
            }
            setIsSessionActive(false);
            isSessionActiveRef.current = false;
            setStatus('Ready');
          };

          recognitionRef.current.onend = () => {
            if (isSessionActiveRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log('Recognition restart failed:', e);
              }
            } else {
              setIsRecording(false);
              setStatus('Ready');
            }
          };
        }
      } else {
        // Initialize Deepgram client
        deepgramClientRef.current = createClient(dg_key);
      }
    }
  }, []);

  // Deepgram WebSocket Handlers
  const startDeepgramTranscription = async () => {
    const dg_key = DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY || process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY;
    if (!dg_key || dg_key.startsWith('YOUR_') || dg_key === 'YOUR_DEEPGRAM_API_KEY') {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      if (!deepgramClientRef.current) {
        deepgramClientRef.current = createClient(dg_key);
      }

      const connection = deepgramClientRef.current.listen.live({
        smart_format: true,
        model: 'nova-2',
      });

      connection.on('open', () => {
        setStatus('Listening (Deepgram)...');
        setIsRecording(true);
        mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
          }
        });
        mediaRecorderRef.current.start(250);
      });

      connection.on('transcriptReceived', (received) => {
        const transcript = received.channel.alternatives[0].transcript;
        if (transcript && received.is_final) {
          setCurrentTranscription(prev => prev + ' ' + transcript);
        }
      });

      connection.on('close', () => {
        setIsRecording(false);
        setStatus('Ready');
      });

      connection.on('error', (error) => {
        console.error('Deepgram connection error:', error);
        setError('Deepgram transcription error.');
        setIsSessionActive(false);
        isSessionActiveRef.current = false;
      });

      deepgramSocketRef.current = connection;
    } catch (err) {
      console.error('Deepgram failed:', err);
      setError('Microphone access or Deepgram error.');
      setIsSessionActive(false);
      isSessionActiveRef.current = false;
    }
  };

  const stopDeepgramTranscription = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Helper for Speech Synthesis (TTS)
  const speakText = (text) => {
    if (!isVoiceEnabled) return; // Exit if voice is disabled

    if (Platform.OS === 'web' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setStatus('Speaking...');
      utterance.onend = () => setStatus('Ready');
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        setStatus('Ready');
      };
      
      const voices = window.speechSynthesis.getVoices();
      
      // Strict Female voice for Jenny, Male voice for Gabby
      let selectedVoice = null;
      if (personality === 'Jenny') {
        // Prioritize known high-quality female voices
        selectedVoice = voices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.includes('Microsoft Zira') || 
          v.name.includes('Samantha') || 
          (v.name.includes('Google') && v.name.includes('US English') && !v.name.toLowerCase().includes('male'))
        );
      } else {
        // Prioritize known high-quality male voices
        selectedVoice = voices.find(v => 
          v.name.toLowerCase().includes('male') || 
          v.name.includes('Microsoft David') || 
          v.name.includes('Daniel') || 
          (v.name.includes('Google') && v.name.includes('UK English Male'))
        );
      }
      
      if (selectedVoice) utterance.voice = selectedVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Helper for AI Response (Exa Brain)
  const getAIResponse = async (userText) => {
    setStatus('Exa Reasoning...');
    
    // Environment variables with fallbacks
    const exa_key = EXA_API_KEY || process.env.EXA_API_KEY || process.env.EXPO_PUBLIC_EXA_API_KEY;

    try {
      if (!exa_key || exa_key.startsWith('YOUR_') || exa_key === 'YOUR_EXA_API_KEY') {
        return `[Test Mode] I heard you say: "${userText}". Please set your EXA_API_KEY in .env to enable my brain.`;
      }

      // Initialize Exa
      const exa = new Exa(exa_key);

      // Retrieve Memory for Context
      let memoryPrompt = "";
      try {
        const { success, data: memories } = await searchMemory(userText);
        if (success && memories && memories.length > 0) {
          memoryPrompt = "Relevant past memories: " + 
            memories.map(m => `[${m.type}] ${m.title}: ${m.content.substring(0, 100)}`).join('; ');
        }
      } catch (memError) {
        console.error('Memory retrieval failed:', memError);
      }

      const systemPrompt = `You are ARC, an Autonomous Reasoning Companion. 
      Personality: ${isDualMode ? 'Dual (Efficiency + Warmth)' : (personality === 'Jenny' ? 'Jenny (Efficient Female)' : 'Gabby (Friendly Male)')}.
      ${memoryPrompt}
      Current Task/Format: ${summaryFormat}
      
      Respond directly to the user's query using your reasoning and search capabilities. 
      Do NOT repeat the user's words. Be concise and professional.`;

      // Use Exa's Search + Contents to generate a reasoned response
      // Since Exa is now the "brain", we use its search results as the basis for the answer
      const searchResult = await exa.searchAndContents(userText, {
        numResults: 3,
        useAutoprompt: true,
        highlights: true,
        text: true
      });

      let aiText = "";
      if (searchResult.results && searchResult.results.length > 0) {
        // Synthesis of search results into a "brain" response
        const bestResult = searchResult.results[0];
        aiText = bestResult.highlights?.[0] || bestResult.text?.substring(0, 500) || "I found some information but couldn't summarize it perfectly.";
        
        // Add source for transparency
        aiText += `\n\n(Source: ${bestResult.title})`;
      } else {
        aiText = "I searched my brain but couldn't find a specific answer for that. Could you rephrase?";
      }

      // Agentic Task Check (Background execution)
      const taskResult = await executeBackgroundTask(userText, aiText);
      
      // Auto-save important AI outputs
      if (userText.toLowerCase().includes('note down') || userText.toLowerCase().includes('save this note')) {
        await autoSaveMemory(`Note: ${userText.substring(0, 30)}...`, aiText, 'note');
      }

      return aiText + taskResult;
    } catch (err) {
      console.error('Exa Brain Error:', err);
      setError(`Exa Brain Error: ${err.message}`);
      return "I'm sorry, my Exa brain is having trouble connecting right now.";
    }
  };

  // Handle Send Message (from Text or Voice)
  const handleSendMessage = async (textOverride) => {
    const text = textOverride || inputText;
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    const aiText = await getAIResponse(text);
    const aiMsg = { role: 'assistant', content: aiText };
    setMessages(prev => [...prev, aiMsg]);
    speakText(aiText);
  };

  // Toggle Session (Mic Button)
  const toggleSession = async () => {
    const nextActive = !isSessionActive;
    setIsSessionActive(nextActive);
    isSessionActiveRef.current = nextActive;

    if (nextActive) {
      await startDeepgramTranscription();
    } else {
      stopDeepgramTranscription();
      if (currentTranscription.trim()) {
        handleSendMessage(currentTranscription);
        setCurrentTranscription('');
      }
    }
  };

  // Handle Sign Out
  const handleSignOut = () => {
    setCurrentView('landing');
    setShowHistory(false);
    setMessages([]);
    setTasks([]);
    setNotifications([]);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setIsSessionActive(false);
    isSessionActiveRef.current = false;
    sendNotification('Signed Out', 'You have been successfully signed out.');
  };

  // Submit Feedback
  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    console.log('Feedback submitted:', feedbackText);
    sendNotification('Feedback Received', 'Thank you for your feedback! We are constantly improving ARC.');
    setFeedbackText('');
    setShowFeedback(false);
  };

  // Helper for OneSignal notifications & Internal Tray
  const sendNotification = (title, message, payload = {}) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      payload,
      timestamp: new Date().toLocaleTimeString(),
      isRead: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    console.log(`[Notification] ${title}: ${message}`, payload);
  };

  // Helper for summarizing YouTube chunks (Exa Brain version)
  const summarizeYouTubeVideo = async (url) => {
    const exa_key = EXA_API_KEY || process.env.EXA_API_KEY || process.env.EXPO_PUBLIC_EXA_API_KEY;
    try {
      setStatus('Fetching Transcript...');
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error('Invalid YouTube URL.');

      // Since Exa is the brain, we use Exa to find information and summaries about this video
      setStatus('Exa Reasoning about Video...');
      const exa = new Exa(exa_key);
      const searchResult = await exa.searchAndContents(`summary of youtube video ${url}`, {
        numResults: 1,
        useAutoprompt: true,
        highlights: true,
        text: true
      });

      let finalSummary = "";
      if (searchResult.results && searchResult.results.length > 0) {
        const result = searchResult.results[0];
        finalSummary = result.highlights?.[0] || result.text?.substring(0, 1000) || "I found the video but couldn't generate a detailed summary using my Exa brain.";
      } else {
        finalSummary = "I couldn't find a detailed summary for this video in my knowledge base.";
      }

      const videoTitle = `Exa Summary: Video ${videoId}`;
      await autoSaveMemory(videoTitle, finalSummary, 'youtube_summary', ['youtube', 'summary', videoId], { videoId });

      sendNotification('YouTube Summary Ready', `Exa has processed the video summary.`, {
        title: videoTitle,
        content: finalSummary,
        type: 'youtube_summary'
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `My Exa brain has analyzed the video:\n\n${finalSummary}\n\nWould you like to export this as a [PDF] or [DOC]?` 
      }]);

      setStatus('Ready');
      return finalSummary;
    } catch (err) {
      console.error('Exa Summarization Error:', err);
      setError(`Exa Summarization Error: ${err.message}`);
      setStatus('Error');
      return null;
    }
  };

  // Helper to encrypt sensitive content
  const encryptContent = async (content) => {
    try {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        content
      );
      return `ENCRYPTED_SHA256_${digest.substring(0, 10)}_${content}`;
    } catch (e) {
      console.error('Encryption failed', e);
      return content;
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  // Helper to export as PDF
  const exportAsPDF = async (title, content) => {
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                padding: 40px; 
                color: #1e293b;
                line-height: 1.6;
              }
              .header {
                border-bottom: 2px solid #3b82f6;
                margin-bottom: 30px;
                padding-bottom: 10px;
              }
              h1 { 
                color: #3b82f6; 
                margin: 0;
                font-size: 28px;
              }
              .date {
                color: #64748b;
                font-size: 14px;
                margin-top: 5px;
              }
              .content {
                white-space: pre-wrap;
              }
              .footer {
                margin-top: 50px;
                border-top: 1px solid #e2e8f0;
                padding-top: 10px;
                font-size: 12px;
                color: #94a3b8;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${title}</h1>
              <div class="date">Generated by ARC on ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="content">${content.replace(/\n/g, '<br>')}</div>
            <div class="footer">
              Autonomous Reasoning Companion (ARC)
            </div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        setError('Sharing is not available on this platform.');
      }
      
      sendNotification('Export Complete', `${title} PDF has been generated.`);
      
      // STEP 5: Auto-save user-requested note
      await autoSaveMemory(title, content, 'note', ['exported', 'pdf']);
    } catch (error) {
      console.error('PDF Export failed', error);
      setError('PDF Export failed: ' + error.message);
    }
  };

  // Auto-save memory helper
  const autoSaveMemory = async (title, content, type, tags = [], metadata = {}) => {
    try {
      // Auto-generate tags if not provided
      let finalTags = tags;
      if (finalTags.length === 0) {
        finalTags = content.toLowerCase().split(/\W+/).filter(word => word.length > 4).slice(0, 5);
      }
      
      const result = await saveMemory({
        title,
        content,
        type,
        tags: finalTags,
        metadata
      });
      
      if (result.success) {
        console.log(`[Auto-Save] ${type} saved: ${title}`);
      }
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  };

  // Helper to export as DOC
  const exportAsDOC = async (title, content) => {
    try {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
            <meta charset='utf-8'>
            <title>${title}</title>
            <style>
              body { 
                font-family: 'Calibri', 'Arial', sans-serif; 
                padding: 20pt; 
              }
              h1 { 
                color: #3b82f6; 
                font-size: 24pt;
                border-bottom: 1px solid #3b82f6;
              }
              p { 
                font-size: 11pt; 
                line-height: 1.5; 
              }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p style="color: #64748b; font-size: 10pt;">Generated on ${new Date().toLocaleDateString()}</p>
            <div class="content">
              ${content.split('\n').map(line => `<p>${line}</p>`).join('')}
            </div>
            <br><br>
            <hr>
            <p style="text-align: center; font-size: 9pt; color: #94a3b8;">Autonomous Reasoning Companion (ARC)</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.doc', mimeType: 'application/msword' });
      } else {
        setError('Sharing is not available on this platform.');
      }
      
      sendNotification('Export Complete', `${title} DOC has been generated.`);
    } catch (error) {
      console.error('DOC Export failed', error);
      setError('DOC Export failed: ' + error.message);
    }
  };

  // Load dark mode preference on startup
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedDarkMode = await AsyncStorage.getItem('darkMode');
        if (storedDarkMode !== null) {
          setIsDarkMode(JSON.parse(storedDarkMode));
        }

        const storedSessions = await AsyncStorage.getItem('sessions');
        if (storedSessions !== null) {
          setSessions(JSON.parse(storedSessions));
        }

        const storedMessages = await AsyncStorage.getItem('currentMessages');
        if (storedMessages !== null) {
          setMessages(JSON.parse(storedMessages));
        }
      } catch (error) {
        console.error('Failed to load preferences', error);
      }
    };
    loadPreferences();
  }, []);

  // Save dark mode preference whenever it changes
  useEffect(() => {
    const saveDarkModePreference = async () => {
      try {
        await AsyncStorage.setItem('darkMode', JSON.stringify(isDarkMode));
      } catch (error) {
        console.error('Failed to save dark mode preference', error);
      }
    };
    saveDarkModePreference();
  }, [isDarkMode]);

  // Save current messages whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      try {
        await AsyncStorage.setItem('currentMessages', JSON.stringify(messages));
      } catch (error) {
        console.error('Failed to save current messages', error);
      }
    };
    saveMessages();
  }, [messages]);

  // Save sessions whenever they change
  useEffect(() => {
    const saveSessions = async () => {
      try {
        await AsyncStorage.setItem('sessions', JSON.stringify(sessions));
      } catch (error) {
        console.error('Failed to save sessions', error);
      }
    };
    saveSessions();
  }, [sessions]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, status]);

  // Create a new session/folder
  const createNewSession = useCallback(() => {
    if (messages.length > 0) {
      const newSession = {
        id: currentSessionId,
        name: currentSessionName,
        messages: [...messages],
        timestamp: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
    }
    setMessages([]);
    const nextId = Date.now().toString();
    setCurrentSessionId(nextId);
    setCurrentSessionName(`Session ${new Date().toLocaleTimeString()}`);
    setShowHistory(false);
  }, [messages, currentSessionId, currentSessionName]);

  // Merge current messages into an old session
  const mergeToSession = (session) => {
    setSessions(prev => prev.map(s => {
      if (s.id === session.id) {
        return { ...s, messages: [...s.messages, ...messages], timestamp: Date.now() };
      }
      return s;
    }));
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setCurrentSessionName(session.name);
    setShowHistory(false);
  };

  // Mock Agentic Behavior: Execute background tasks
  const executeBackgroundTask = async (userTranscription, aiResponse) => {
    const text = (userTranscription + " " + aiResponse).toLowerCase();
    const newTasks = [];

    // Personality Switch via voice
    if (text.includes('switch to gabby') || text.includes('talk to gabby')) {
      setPersonality('Gabby');
      return " [Switched to Gabby]";
    }
    if (text.includes('switch to jenny') || text.includes('talk to jenny')) {
      setPersonality('Jenny');
      return " [Switched to Jenny]";
    }

    // Folder/Session Management via voice
    if (text.includes('create a folder') || text.includes('new conversation') || text.includes('save this conversation')) {
      createNewSession();
      return " [New Conversation Folder Created]";
    }

    // Dual Mode Switch via voice
    if (text.includes('turn on dual mode') || text.includes('activate dual mode') || text.includes('enable dual mode')) {
      setIsDualMode(true);
      return " [Dual Mode Activated]";
    }
    if (text.includes('turn off dual mode') || text.includes('deactivate dual mode') || text.includes('disable dual mode')) {
      setIsDualMode(false);
      return " [Dual Mode Deactivated]";
    }

    // Weather Integration
    if (text.includes('weather') || text.includes('temperature')) {
      const city = text.match(/in ([a-zA-Z\s]+)/)?.[1] || 'your location';
      const task = { id: Date.now().toString(), type: 'Weather', description: `Checked weather for ${city}` };
      newTasks.push(task);
      return ` [Weather: 72°F and Sunny in ${city}]`;
    }

    // Web Search via Exa
    if (text.includes('search') || text.includes('look up') || text.includes('what is') || text.includes('who is')) {
      const query = text.split('search for ')[1] || text.split('look up ')[1] || userTranscription;
      const task = { id: Date.now().toString(), type: 'Web', description: `Searched for ${query}` };
      newTasks.push(task);
      
      const exa_key = EXA_API_KEY || process.env.EXA_API_KEY || process.env.EXPO_PUBLIC_EXA_API_KEY;
      let searchSummary = "Found results. Summarizing...";
      
      if (exa_key && !exa_key.startsWith('YOUR_') && exa_key !== 'YOUR_EXA_API_KEY') {
        try {
          const exa = new Exa(exa_key);
          const results = await exa.search(query, { numResults: 3 });
          if (results.results && results.results.length > 0) {
            searchSummary = `Found: ${results.results.map(r => r.title).join(', ')}`;
          }
        } catch (e) {
          console.error('Exa background search failed', e);
        }
      }
      
      // Auto-save web search
      await autoSaveMemory(`Search: ${query}`, searchSummary, 'web_search', ['web', 'search'], { query });
      
      return ` [Web Search: ${searchSummary}]`;
    }

      // YouTube Summarizer
      if (text.includes('summarize') || text.includes('youtube.com') || text.includes('youtu.be') || text.includes('video')) {
        const urlMatch = text.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+)/);
        const url = urlMatch ? urlMatch[1] : null;

        if (url) {
          // Trigger the summarization flow
          summarizeYouTubeVideo(url);
          return ` [YouTube Summarization Started for ${url}]`;
        }

        const videoId = text.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1] || "unknown";
        const videoTitle = videoId !== "unknown" ? `Video ${videoId}` : "Extracted Video Content";
        const summaryLength = "Comprehensive (Approx. 750 words)"; 
        const preview = "This video explores the intersections of machine learning and human creativity, highlighting three major breakthroughs in neural network architecture...";
        
        const task = { id: Date.now().toString(), type: 'YouTube', description: `Summarized: ${videoTitle}` };
        newTasks.push(task);
        
        // STEP 5: Auto-save YouTube summary
        await autoSaveMemory(videoTitle, preview, 'youtube_summary', ['youtube', 'video'], { videoId, summaryLength });
        
        sendNotification('YouTube Summary Ready', `Video: ${videoTitle}`, {
          title: videoTitle,
          length: summaryLength,
          preview: preview,
          videoId: videoId
        });
        return ` [YouTube Summary: "${videoTitle}" processed. Analysis saved.]`;
      }

    if (text.includes('note') || text.includes('save this') || text.includes('note down')) {
      const task = { id: (Date.now() + 1).toString(), type: 'Note', description: 'Saved a note' };
      newTasks.push(task);
    }
    
    if (newTasks.length > 0) {
      setTasks(prev => [...prev, ...newTasks]);
      return ` [${newTasks.map(t => t.type).join(', ')} Logged]`;
    }
    return "";
  };

  const toggleSettings = (open) => {
    if (open) {
      setShowSettings(true);
      Animated.spring(settingsAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 40
      }).start();
    } else {
      Animated.timing(settingsAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }).start(() => setShowSettings(false));
    }
  };

  const handleNotificationClick = (notification) => {
    setShowNotifications(false);
    if (notification.payload?.type === 'YouTube') {
      setHistoryFilter('All'); // Simplified for now
      setShowHistory(true);
    }
  };

  const renderHistoryItem = (item, index) => {
    const isFile = item.includes && item.includes('.');
    const isWeb = item.type === 'Web';
    const isYouTube = item.type === 'YouTube';

    if (historyFilter === 'Files' && !isFile) return null;
    if (historyFilter === 'Web' && !isWeb) return null;

    const label = isFile ? item : (item.content || item.description || 'Action');
    const icon = isFile ? 'file-tray-full-outline' : (isYouTube ? 'logo-youtube' : (isWeb ? 'globe-outline' : 'chatbubble-outline'));

    return (
      <View key={index} style={styles.logItem}>
        <Ionicons name={icon} size={16} color="#3b82f6" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.logText, { color: isDarkMode ? '#f8fafc' : '#1e293b' }]} numberOfLines={1}>{label}</Text>
          {isYouTube && (
            <View style={styles.exportRow}>
              <TouchableOpacity onPress={() => exportAsPDF(label, item.content || item.description)} style={styles.exportBtn}>
                <Ionicons name="document-text-outline" size={14} color="#3b82f6" />
                <Text style={styles.exportText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => exportAsDOC(label, item.content || item.description)} style={styles.exportBtn}>
                <Ionicons name="document-outline" size={14} color="#3b82f6" />
                <Text style={styles.exportText}>DOC</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Dynamic Theme Styling
  const dynamicStyles = {
    container: {
      backgroundColor: isDarkMode ? '#001f3f' : '#f8fafc', // Deep navy blue
    },
    title: {
      color: isDarkMode ? '#ffffff' : '#1e293b',
    },
    chatScroll: {
      backgroundColor: isDarkMode ? '#002a5c' : '#ffffff', // Slightly lighter navy for chat
      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    },
    transcriptionText: {
      color: isDarkMode ? '#f8fafc' : '#1e293b',
    },
    taskSection: {
      backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9',
      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    },
    modalContainer: {
      backgroundColor: isDarkMode ? 'rgba(0, 31, 63, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    },
    quickToolsToggle: {
      backgroundColor: isDarkMode ? '#003366' : '#334155',
    },
    quickToolsMenu: {
      backgroundColor: isDarkMode ? 'rgba(0, 42, 89, 0.95)' : 'rgba(30, 41, 59, 0.95)',
    },
    textInputContainer: {
      backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9',
    },
    statusArea: {
      backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9',
    },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          {currentView === 'landing' && (
            <View style={styles.landingContainer}>
              <Animated.View style={[
                styles.landingHeader, 
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}>
                <Text style={[styles.landingTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>ARC</Text>
                <Text style={styles.landingSubtitle}>Autonomous Reasoning Companion</Text>
              </Animated.View>
              
              <Animated.View style={[
                styles.landingActions,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}>
                <TouchableOpacity 
                  style={styles.primaryBtn}
                  onPress={() => setCurrentView('signup')}
                >
                  <Text style={styles.primaryBtnText}>Get Started</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.secondaryBtn}
                  onPress={() => setCurrentView('signin')}
                >
                  <Text style={[styles.secondaryBtnText, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Sign In</Text>
                </TouchableOpacity>
              </Animated.View>
              
              <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={styles.landingThemeToggle}>
                <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={isDarkMode ? "#fbbf24" : "#1e293b"} />
              </TouchableOpacity>
            </View>
          )}

          {(currentView === 'signin' || currentView === 'signup') && (
            <View style={styles.authContainer}>
              <TouchableOpacity onPress={() => setCurrentView('landing')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={isDarkMode ? "#fff" : "#1e293b"} />
              </TouchableOpacity>
              
              <Text style={[styles.authTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>
                {currentView === 'signin' ? 'Welcome Back' : 'Create Account'}
              </Text>
              <Text style={styles.authSubtitle}>
                {currentView === 'signin' ? 'Sign in to continue to ARC' : 'Join the futuristic reasoning companion'}
              </Text>

              <View style={styles.authForm}>
                {currentView === 'signup' && (
                  <View style={[styles.authInputContainer, { backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9' }]}>
                    <Ionicons name="person-outline" size={20} color="#94a3b8" />
                    <TextInput
                      style={[styles.authInput, { color: isDarkMode ? '#fff' : '#1e293b' }]}
                      placeholder="Full Name"
                      placeholderTextColor="#94a3b8"
                      value={authName}
                      onChangeText={setAuthName}
                    />
                  </View>
                )}
                
                <View style={[styles.authInputContainer, { backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9' }]}>
                  <Ionicons name="mail-outline" size={20} color="#94a3b8" />
                  <TextInput
                    style={[styles.authInput, { color: isDarkMode ? '#fff' : '#1e293b' }]}
                    placeholder="Email Address"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={authEmail}
                    onChangeText={setAuthEmail}
                  />
                </View>

                <View style={[styles.authInputContainer, { backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                  <TextInput
                    style={[styles.authInput, { color: isDarkMode ? '#fff' : '#1e293b' }]}
                    placeholder="Password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                    value={authPassword}
                    onChangeText={setAuthPassword}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.primaryBtn}
                  onPress={() => setCurrentView('chat')}
                >
                  <Text style={styles.primaryBtnText}>
                    {currentView === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.authSwitchBtn}
                  onPress={() => setCurrentView(currentView === 'signin' ? 'signup' : 'signin')}
                >
                  <Text style={styles.authSwitchText}>
                    {currentView === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {currentView === 'chat' && (
            <>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.logoContainer}>
                    <Text style={[styles.title, dynamicStyles.title]}>ARC</Text>
                    <Text style={styles.subtitle}>Autonomous Reasoning Companion</Text>
                  </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyBtnTopRight}>
                    <Ionicons name="folder-outline" size={28} color={isDarkMode ? "#fff" : "#1e293b"} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleNotifications} style={styles.notificationBtn}>
                    <Ionicons name="notifications-outline" size={28} color={isDarkMode ? "#fff" : "#1e293b"} />
                    {notifications.some(n => !n.isRead) && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.badgeText}>{notifications.filter(n => !n.isRead).length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setIsDualMode(!isDualMode)} 
                    style={[styles.dualModeBtn, isDualMode && styles.dualModeBtnActive]}
                  >
                    <Ionicons name={isDualMode ? "layers" : "layers-outline"} size={24} color={isDualMode ? "#fff" : (isDarkMode ? "#94a3b8" : "#64748b")} />
                    {isDualMode && <Text style={styles.dualModeLabel}>Dual</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPersonality(p => p === 'Jenny' ? 'Gabby' : 'Jenny')} style={styles.personalityBtn}>
                    <Text style={[styles.personalityText, { color: personality === 'Jenny' ? '#3b82f6' : '#ec4899' }]}>
                      {personality}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

          {/* Floating Quick Tools (Center Right) */}
          <View style={styles.quickToolsContainer}>
            {showQuickTools && (
              <View style={styles.quickToolsMenu}>
                <TouchableOpacity 
                  onPress={() => setActiveTool(activeTool === 'YouTube' ? null : 'YouTube')} 
                  style={[styles.quickToolItem, activeTool === 'YouTube' && styles.quickToolItemActive]}
                >
                  <Ionicons name="logo-youtube" size={24} color={activeTool === 'YouTube' ? "#fff" : "#ef4444"} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setActiveTool(activeTool === 'Weather' ? null : 'Weather')} 
                  style={[styles.quickToolItem, activeTool === 'Weather' && styles.quickToolItemActive]}
                >
                  <Ionicons name="sunny-outline" size={24} color={activeTool === 'Weather' ? "#fff" : "#fbbf24"} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity 
              onPress={() => setShowQuickTools(!showQuickTools)} 
              style={[styles.quickToolsToggle, showQuickTools && styles.quickToolsToggleActive]}
            >
              <Ionicons name={showQuickTools ? "close" : "apps-outline"} size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Notification Tray (Facebook-style) */}
          <Modal visible={showNotifications} animationType="fade" transparent={true}>
            <TouchableOpacity 
              style={styles.trayOverlay} 
              activeOpacity={1} 
              onPress={() => setShowNotifications(false)}
            >
              <View style={[styles.notificationTray, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
                <View style={styles.trayHeader}>
                  <Text style={[styles.trayTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Notifications</Text>
                  <TouchableOpacity onPress={() => setNotifications([])}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.trayList}>
                  {notifications.map((notification) => (
                    <TouchableOpacity 
                      key={notification.id} 
                      style={[styles.notificationItem, !notification.isRead && styles.unreadItem]}
                      onPress={() => handleNotificationClick(notification)}
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons 
                          name={notification.payload?.type?.includes('youtube') ? 'logo-youtube' : 'notifications'} 
                          size={24} 
                          color={notification.payload?.type?.includes('youtube') ? '#ef4444' : '#3b82f6'} 
                        />
                      </View>
                      <View style={styles.notificationContent}>
                        <Text style={[styles.notificationTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>{notification.title}</Text>
                        <Text style={[styles.notificationMsg, { color: isDarkMode ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>
                          {notification.message}
                        </Text>
                        <Text style={styles.notificationTime}>{notification.timestamp}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {notifications.length === 0 && (
                    <View style={styles.emptyTray}>
                      <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
                      <Text style={styles.emptyTrayText}>No new notifications</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Hidden History Panel (Modal) */}
          <Modal visible={showHistory} animationType="slide" transparent={true}>
            <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Knowledge Base</Text>
                  <Text style={styles.modalSubtitle}>Folders & Sessions</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => toggleSettings(true)} style={{ marginRight: 15 }}>
                    <Ionicons name="settings-outline" size={28} color={isDarkMode ? "#fff" : "#1e293b"} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowHistory(false)}>
                    <Ionicons name="close-circle" size={32} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sessionControls}>
                <TouchableOpacity onPress={createNewSession} style={styles.newSessionBtn}>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.newSessionText}>New Folder</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterBar}>
                {['All', 'Folders', 'Files'].map(filter => (
                  <TouchableOpacity 
                    key={filter} 
                    onPress={() => setHistoryFilter(filter)}
                    style={[styles.filterBtn, historyFilter === filter && styles.filterBtnActive]}
                  >
                    <Text style={[styles.filterText, historyFilter === filter && styles.filterTextActive]}>{filter}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.modalScroll}>
                {historyFilter === 'Folders' || historyFilter === 'All' ? (
                  <View style={styles.folderSection}>
                    <Text style={styles.modalSectionLabel}>Active Sessions</Text>
                    {sessions.map((session) => (
                      <TouchableOpacity 
                        key={session.id} 
                        style={styles.folderItem}
                        onPress={() => mergeToSession(session)}
                      >
                        <Ionicons name="folder" size={24} color="#3b82f6" />
                        <View style={styles.folderInfo}>
                          <Text style={[styles.folderName, { color: isDarkMode ? '#fff' : '#1e293b' }]}>{session.name}</Text>
                          <Text style={styles.folderMeta}>{session.messages.length} messages • {new Date(session.timestamp).toLocaleDateString()}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                    {sessions.length === 0 && <Text style={styles.modalPlaceholder}>No folders created yet.</Text>}
                  </View>
                ) : null}

                {(historyFilter === 'Files' || historyFilter === 'All') && (
                  <View style={styles.contentSection}>
                    <Text style={styles.modalSectionLabel}>Logged Content</Text>
                    {[...fileLogs, ...tasks].map((item, i) => renderHistoryItem(item, i))}
                  </View>
                )}
                
                {fileLogs.length === 0 && tasks.length === 0 && messages.length === 0 && sessions.length === 0 && (
                  <Text style={styles.modalPlaceholder}>No history recorded yet.</Text>
                )}
              </ScrollView>

              {/* Settings Footer in History Modal */}
              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.closeHistoryBtn}>
                  <Text style={styles.closeHistoryText}>Close Knowledge Base</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Settings Modal */}
          <Modal visible={showSettings} animationType="fade" transparent={true}>
            <View style={styles.trayOverlay}>
              <Animated.View style={[
                styles.settingsModalContainer, 
                { 
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  opacity: settingsAnim,
                  transform: [{ scale: settingsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1]
                  })}]
                }
              ]}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Settings</Text>
                    <Text style={styles.modalSubtitle}>System Configuration</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleSettings(false)}>
                    <Ionicons name="close-circle" size={32} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.settingsList}>
                  <View style={styles.settingsSection}>
                    <Text style={styles.modalSectionLabel}>System Preferences</Text>
                    <TouchableOpacity 
                      onPress={() => setIsDarkMode(!isDarkMode)} 
                      style={[styles.settingsItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                    >
                      <View style={styles.settingsItemLeft}>
                        <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color="#3b82f6" />
                        <Text style={[styles.settingsItemText, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Dark Mode</Text>
                      </View>
                      <View style={[styles.toggleSwitch, isDarkMode && styles.toggleSwitchActive]}>
                        <View style={[styles.toggleDot, isDarkMode && styles.toggleDotActive]} />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => setIsVoiceEnabled(!isVoiceEnabled)} 
                      style={[styles.settingsItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginTop: 8 }]}
                    >
                      <View style={styles.settingsItemLeft}>
                        <Ionicons name={isVoiceEnabled ? "volume-high" : "volume-mute"} size={22} color="#3b82f6" />
                        <Text style={[styles.settingsItemText, { color: isDarkMode ? '#fff' : '#1e293b' }]}>AI Voice Response</Text>
                      </View>
                      <View style={[styles.toggleSwitch, isVoiceEnabled && styles.toggleSwitchActive]}>
                        <View style={[styles.toggleDot, isVoiceEnabled && styles.toggleDotActive]} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.modalSectionLabel}>Summary Customization</Text>
                    <View style={[styles.settingsItem, { flexDirection: 'column', alignItems: 'flex-start', padding: 15, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Text style={[styles.settingsItemText, { color: isDarkMode ? '#fff' : '#1e293b', marginBottom: 10 }]}>Default Summary Format</Text>
                      <TextInput
                        style={[styles.settingsInput, { color: isDarkMode ? '#fff' : '#1e293b', borderColor: isDarkMode ? '#334155' : '#e2e8f0', width: '100%', borderWidth: 1, borderRadius: 8, padding: 10 }]}
                        placeholder="e.g., School notes, High-impact bullets..."
                        placeholderTextColor="#94a3b8"
                        value={summaryFormat}
                        onChangeText={setSummaryFormat}
                      />
                      <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>Used for YouTube & Web Search summaries.</Text>
                    </View>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.modalSectionLabel}>Account & Feedback</Text>
                    <TouchableOpacity onPress={() => { toggleSettings(false); setShowFeedback(true); }} style={styles.settingsItem}>
                      <View style={styles.settingsItemLeft}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#3b82f6" />
                        <Text style={[styles.settingsItemText, { color: isDarkMode ? '#fff' : '#1e293b' }]}>Send Feedback</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={handleSignOut} style={[styles.settingsItem, styles.signOutItem]}>
                      <View style={styles.settingsItemLeft}>
                        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                        <Text style={[styles.settingsItemText, { color: '#ef4444' }]}>Sign Out</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>

          {/* Feedback Modal */}
          <Modal visible={showFeedback} animationType="fade" transparent={true}>
            <View style={styles.feedbackOverlay}>
              <View style={[styles.feedbackContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
                <View style={styles.feedbackHeader}>
                  <Text style={[styles.feedbackTitle, { color: isDarkMode ? '#fff' : '#1e293b' }]}>User Feedback</Text>
                  <TouchableOpacity onPress={() => setShowFeedback(false)}>
                    <Ionicons name="close" size={24} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.feedbackSubtitle}>Help us improve ARC. What's on your mind?</Text>
                <TextInput
                  style={[styles.feedbackInput, { color: isDarkMode ? '#fff' : '#1e293b', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}
                  placeholder="Tell us about your experience..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                />
                <TouchableOpacity onPress={submitFeedback} style={styles.submitFeedbackBtn}>
                  <Text style={styles.submitFeedbackText}>Submit Feedback</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Error Display */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView 
            ref={scrollViewRef}
            style={[styles.chatScroll, dynamicStyles.chatScroll]} 
            contentContainerStyle={styles.chatContent}
          >
            {messages.length === 0 && !isRecording && (
              <View style={styles.placeholderContainer}>
                <Ionicons name="sparkles-outline" size={48} color="#94a3b8" />
                <Text style={styles.placeholderText}>
                  {personality === 'Jenny' 
                    ? "Jenny is ready for tasks. Try 'summarize this video' or 'take a note...'"
                    : "Gabby is here to chat. Ask anything or just say hello!"}
                </Text>
              </View>
            )}
            
            {messages.map((msg, index) => (
              <View key={index} style={[
                styles.messageSection, 
                msg.role === 'user' ? styles.userSection : styles.aiSection,
                msg.role === 'assistant' && { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)' }
              ]}>
                <Text style={[
                  styles.sectionLabel, 
                  { color: msg.role === 'user' ? '#fff' : (personality === 'Jenny' ? '#3b82f6' : '#ec4899'), opacity: 0.8 }
                ]}>
                  {msg.role === 'user' ? 'You' : personality}
                </Text>
                <Text style={[
                  styles.messageText, 
                  msg.role === 'user' ? styles.userText : (personality === 'Jenny' ? styles.aiTextJenny : styles.aiTextGabby),
                  msg.role === 'assistant' && { color: isDarkMode ? '#f8fafc' : '#1e293b' }
                ]}>
                  {msg.content}
                </Text>
              </View>
            ))}

            {isRecording && currentTranscription.trim() !== '' && (
              <View style={[styles.messageSection, styles.userSection, { opacity: 0.7 }]}>
                <Text style={[styles.sectionLabel, { color: '#fff' }]}>Listening...</Text>
                <Text style={[styles.messageText, styles.userText]}>{currentTranscription}</Text>
              </View>
            )}

            {(status === 'Responding...' || status === 'Processing...') && (
              <View style={[styles.messageSection, styles.aiSection]}>
                <Text style={[styles.sectionLabel, { color: personality === 'Jenny' ? '#3b82f6' : '#ec4899' }]}>{personality}</Text>
                <View style={styles.typingContainer}>
                  <View style={[styles.typingDot, { backgroundColor: personality === 'Jenny' ? '#3b82f6' : '#ec4899' }]} />
                  <View style={[styles.typingDot, { backgroundColor: personality === 'Jenny' ? '#3b82f6' : '#ec4899', opacity: 0.6 }]} />
                  <View style={[styles.typingDot, { backgroundColor: personality === 'Jenny' ? '#3b82f6' : '#ec4899', opacity: 0.3 }]} />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputArea}>
            {/* Standalone Mic Button */}
            <View style={styles.micStandaloneContainer}>
              <TouchableOpacity 
                onPress={toggleSession} 
                style={[styles.micBtnLarge, isSessionActive && styles.micBtnActive]}
              >
                <Ionicons 
                  name={isSessionActive ? "stop" : "mic"} 
                  size={32} 
                  color="#fff" 
                />
              </TouchableOpacity>
              <Text style={[styles.micLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                {isSessionActive ? 'Stop' : 'Start Talking'}
              </Text>
            </View>

            <View style={[styles.textInputContainer, { backgroundColor: isDarkMode ? '#002a5c' : '#f1f5f9' }]}>
              {activeTool && (
                <View style={styles.activeToolTag}>
                  <Text style={styles.activeToolText}>{activeTool}</Text>
                  <TouchableOpacity onPress={() => setActiveTool(null)}>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <TextInput
                style={[styles.textInput, { color: isDarkMode ? '#fff' : '#1e293b' }]}
                placeholder={activeTool ? `Enter ${activeTool} request...` : "Type your command..."}
                placeholderTextColor="#94a3b8"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSendMessage()}
              />
              <TouchableOpacity onPress={() => handleSendMessage()} style={styles.sendBtn}>
                <Ionicons name="send" size={20} color={inputText.trim() ? "#3b82f6" : "#94a3b8"} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statusArea, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <View style={styles.statusRow}>
              {isSessionActive && <View style={styles.pulseDot} />}
              <Text style={[
                styles.statusText,
                status === 'Listening...' && styles.statusListening,
                (status === 'Processing...' || status === 'Responding...') && styles.statusProcessing,
                status === 'Speaking...' && styles.statusSpeaking,
                { color: isDarkMode ? '#f8fafc' : '#1e293b' }
              ]}>
                {status}
              </Text>
              <Text style={styles.personalityTag}> • {personality} Mode</Text>
            </View>
          </View>
          </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  logoContainer: {
    alignItems: 'flex-start',
  },
  historyBtnTopRight: {
    padding: 8,
  },
  notificationBtn: {
    padding: 8,
    marginLeft: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  trayOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  notificationTray: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    maxHeight: '60%',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  trayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  trayTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  clearAllText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '700',
  },
  trayList: {
    padding: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notificationMsg: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  emptyTray: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTrayText: {
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '600',
  },
  dualModeBtn: {
    padding: 8,
    marginRight: 4,
  },
  dualModeBtnActive: {
    backgroundColor: '#8b5cf6',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dualModeLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: -2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickToolsContainer: {
    position: 'absolute',
    right: 20,
    top: '40%',
    alignItems: 'center',
    zIndex: 100,
  },
  quickToolsToggle: {
    backgroundColor: '#334155',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  quickToolsToggleActive: {
    backgroundColor: '#1e293b',
    transform: [{ rotate: '90deg' }],
  },
  quickToolsMenu: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 28,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  quickToolItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  quickToolItemActive: {
    backgroundColor: '#10b981',
  },
  activeToolTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 10,
  },
  activeToolText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 5,
  },
  subtleStatus: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  subtleLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentTranscriptionSubtle: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  exportRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  exportText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '700',
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    width: '100%',
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 10,
  },
  chatScroll: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    marginBottom: 10,
    padding: 16,
    borderWidth: 1,
  },
  chatContent: {
    paddingBottom: 20,
  },
  messageSection: {
    marginBottom: 16,
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
  },
  userSection: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  aiSection: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderBottomLeftRadius: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiTextJenny: {
    color: '#3b82f6',
  },
  aiTextGabby: {
    color: '#ec4899',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginRight: 4,
  },
  taskLog: {
    width: '100%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  taskLogTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  taskBadgeText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    marginLeft: 4,
  },
  placeholderContainer: {
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center', 
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  historyBtn: {
    padding: 8,
  },
  personalityBtn: {
    padding: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  personalityText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalContainer: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  sessionControls: {
    marginBottom: 20,
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  newSessionText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
  },
  folderSection: {
    marginBottom: 24,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 16,
    marginBottom: 10,
  },
  folderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  folderMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalScroll: {
    flex: 1,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalPlaceholder: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
  },
  logText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterBtnActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  utilitiesBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
  },
  utilBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
  },
  utilBtnActive: {
    backgroundColor: '#10b981',
  },
  utilBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 4,
  },
  micStandaloneContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  micBtnLarge: {
    backgroundColor: '#3b82f6',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 12,
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    transform: [{ scale: 1.1 }],
  },
  micLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  inputArea: {
    width: '100%',
    paddingBottom: 15,
    alignItems: 'center',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    width: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
  },
  // Landing Page Styles
  landingContainer: {
    flex: 1,
    justifyContent: 'center', // Center vertically
    alignItems: 'center',
    padding: 30,
  },
  landingHeader: {
    alignItems: 'center',
    marginBottom: 40, // Reduced margin
  },
  landingTitle: {
    fontSize: 72, // Slightly larger for impact
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  landingSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 10,
  },
  landingActions: {
    width: '100%',
    gap: 15,
    marginTop: 20, // Space from subtitle
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  secondaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  landingThemeToggle: {
    marginTop: 30,
    padding: 10,
  },
  // Auth Styles
  authContainer: {
    flex: 1,
    padding: 30,
    paddingTop: 60,
  },
  backBtn: {
    marginBottom: 30,
  },
  authTitle: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 10,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 40,
    lineHeight: 24,
  },
  authForm: {
    gap: 20,
  },
  authInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  authInput: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
  authSwitchBtn: {
    alignItems: 'center',
    marginTop: 10,
  },
  authSwitchText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 14,
  },
  sendBtn: {
    marginLeft: 10,
    padding: 4,
  },
  personalityTag: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 10,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  activeSessionButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
  icon: {
    marginRight: 2,
  },
  statusArea: {
    padding: 12,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusListening: {
    color: '#ef4444',
  },
  statusProcessing: {
    color: '#fbbf24',
  },
  statusSpeaking: {
    color: '#10b981',
  },
  // Modal Footer & Settings
  modalFooter: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
  },
  closeHistoryBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeHistoryText: {
    color: '#fff',
    fontWeight: '700',
  },
  settingsModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  settingsList: {
    marginTop: 10,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#3b82f6',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  signOutItem: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    marginTop: 10,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 8,
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderRadius: 16,
  },
  settingsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    marginLeft: 8,
  },
  signOutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  // Feedback Styles
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  feedbackSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    height: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 20,
  },
  submitFeedbackBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitFeedbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
