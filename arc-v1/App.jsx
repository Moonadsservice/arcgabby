import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sun, 
  Moon, 
  Mic, 
  Square, 
  Send, 
  Folder, 
  Bell, 
  Layers, 
  LayoutGrid, 
  X, 
  Settings, 
  PlusCircle, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  LogOut, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MessageCircle, 
  AlertCircle,
  Car,
  Plane,
  MapPin,
  ArrowLeft,
  User,
  Lock,
  Search,
  Globe,
  FileText,
  File,
  CloudSun,
  Trash2,
  Save
} from 'lucide-react';
import { saveMemory, searchMemory, saveUserEmail, supabase } from './src/utils/supabase';
import { useDeepgramAudio } from './src/hooks/useDeepgramAudio';
import { getOpenRouterResponse } from './src/utils/ai';
import { sendEmail } from './src/utils/email';
import { fetchWeather } from './src/utils/weather';

// Environment variables for Vite
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [status, setStatus] = useState('Ready');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('currentMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const [tasks, setTasks] = useState([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [personality, setPersonality] = useState('Jenny');
  const [isDualMode, setIsDualMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(false);
  const [activeFlightStep, setActiveFlightStep] = useState(null); // 'contacts_choice', 'contact_name', 'book_ride_ask'
  const [wantsArrivalRide, setWantsArrivalRide] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'landing';
  });

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [historyFilter, setHistoryFilter] = useState('All');
  const [activeTool, setActiveTool] = useState(null);
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [isWeatherSearching, setIsWeatherSearching] = useState(false);
  const [weatherData, setWeatherData] = useState(() => {
    const saved = localStorage.getItem('weatherData');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (weatherData) {
      localStorage.setItem('weatherData', JSON.stringify(weatherData));
    }
  }, [weatherData]);
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString());
  const [currentSessionName, setCurrentSessionName] = useState('New Session');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [summaryFormat, setSummaryFormat] = useState('Professional Summary');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showBookRide, setShowBookRide] = useState(false);
  const [rideDestination, setRideDestination] = useState('');
  const [rideCoords, setRideCoords] = useState(null);
  const [showFlightTracker, setShowFlightTracker] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');
  const [notificationToggles, setNotificationToggles] = useState(() => {
    const saved = localStorage.getItem('notificationToggles');
    return saved ? JSON.parse(saved) : {
      emergencyEmail: false,
      meEmail: false,
      call: false,
      sms: false,
      whatsapp: false
    };
  });

  useEffect(() => {
    localStorage.setItem('notificationToggles', JSON.stringify(notificationToggles));
  }, [notificationToggles]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [showRideProviderModal, setShowRideProviderModal] = useState(false);
  const [selectedRideProvider, setSelectedRideProvider] = useState(null); // 'uber' or 'bolt'
  const [flightMonitoring, setFlightMonitoring] = useState({
    active: false,
    number: '',
    status: 'Scheduled',
    lastUpdate: null
  });
  
  const [selectedContactsForFlight, setSelectedContactsForFlight] = useState([]);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [showPWAConfirm, setShowPWAConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (userEmail) {
      localStorage.setItem('userEmail', userEmail);
    } else {
      localStorage.removeItem('userEmail');
    }
  }, [userEmail]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show custom confirm after 5 seconds
      setTimeout(() => {
        setShowPWAConfirm(true);
      }, 5000);
    });
  }, []);

  const [isEmergencyCollapsed, setIsEmergencyCollapsed] = useState(true);
  const [user, setUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Initialize Audio Hook
  const { isListening, status: audioStatus, startListening, stopListening, speak } = useDeepgramAudio(
    async (text, type) => {
      if (type === 'silence') {
        await handleSendMessage(text);
      } else {
        setCurrentTranscription(text);
      }
    },
    { apiKey: DEEPGRAM_API_KEY }
  );

  useEffect(() => {
    setStatus(audioStatus);
    setIsRecording(isListening);
  }, [audioStatus, isListening]);

  // Supabase Auth Listener
  useEffect(() => {
    console.log('Initializing Auth Listener...');
    supabase?.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session ? 'User logged in' : 'No session');
      if (session?.user) {
        setUser(session.user);
        setUserEmail(session.user.email);
        loadUserSessions(session.user.id);
      }
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event, session ? 'Session exists' : 'No session');
      setUser(session?.user ?? null);
      if (session?.user) {
        setUserEmail(session.user.email);
        loadUserSessions(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, redirecting to landing...');
        setUserEmail('');
        setCurrentView('landing');
        localStorage.removeItem('currentView');
      }
      setIsAuthLoading(false);
    });

    return () => {
      console.log('Unsubscribing from Auth Listener');
      subscription?.unsubscribe();
    };
  }, []);

  const loadUserSessions = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'session')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) {
        const loadedSessions = data.map(d => ({ 
          ...d.metadata, 
          id: d.id, 
          messages: d.content,
          timestamp: d.metadata?.timestamp || new Date(d.created_at).getTime()
        }));
        setSessions(loadedSessions);
        // Also update local storage as a cache
        localStorage.setItem('sessions', JSON.stringify(loadedSessions));
      }
    } catch (err) {
      console.error('Error loading sessions from Supabase:', err);
    }
  };

  // OneSignal Initialization
  useEffect(() => {
    if (ONESIGNAL_APP_ID && !ONESIGNAL_APP_ID.startsWith('YOUR_')) {
      const initOneSignal = async () => {
        try {
          const OneSignal = window.OneSignal || [];
          await OneSignal.push(() => {
            OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: true,
              welcomeNotification: {
                title: "ARC Autonomous Reasoning Companion",
                message: "Notifications enabled!"
              }
            });
            
            OneSignal.getUserId().then(id => {
              if (id) console.log("OneSignal Player ID:", id);
            });
          });
        } catch (err) {
          console.error("OneSignal Init Error:", err);
        }
      };
      
      const script = document.createElement('script');
      script.src = "https://cdn.onesignal.com/sdks/OneSignalSDK.js";
      script.async = true;
      document.head.appendChild(script);
      script.onload = initOneSignal;
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTop = scrollViewRef.current.scrollHeight;
    }
  }, [messages, currentTranscription]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('currentMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Auto-save current session to sessions list
  useEffect(() => {
    if (messages.length > 0) {
      const sessionToSave = {
        id: currentSessionId,
        name: currentSessionName,
        messages: [...messages],
        timestamp: Date.now()
      };

      setSessions(prev => {
        const exists = prev.find(s => s.id === currentSessionId);
        if (exists) {
          // Check if content actually changed to avoid unnecessary updates
          const existingSession = prev.find(s => s.id === currentSessionId);
          if (JSON.stringify(existingSession.messages) === JSON.stringify(messages)) {
            return prev;
          }
          return prev.map(s => s.id === currentSessionId ? sessionToSave : s);
        }
        return [sessionToSave, ...prev];
      });
    }
  }, [messages, currentSessionId, currentSessionName]);

  const isSessionActiveRef = useRef(false);
  const scrollViewRef = useRef(null);

  const toggleSession = () => {
    const nextActive = !isSessionActive;
    setIsSessionActive(nextActive);
    isSessionActiveRef.current = nextActive;
    if (nextActive) {
      console.log('Starting Deepgram listening...');
      startListening();
    } else {
      console.log('Stopping Deepgram listening...');
      stopListening();
      if (currentTranscription.trim()) {
        handleSendMessage(currentTranscription);
        setCurrentTranscription('');
      }
    }
  };

  const geocodeDestination = async (destination) => {
    try {
      setStatus('Geocoding...');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setRideCoords({ lat, lon });
        setStatus('Ready');
        return { lat, lon };
      }
      throw new Error('Location not found');
    } catch (err) {
      setError('Could not find that location. Please try again.');
      setStatus('Ready');
      return null;
    }
  };

  const openRideApp = (provider, coords) => {
    if (!coords) return;
    const { lat, lon } = coords;
    let url = provider === 'uber' 
      ? `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lon}`
      : `https://bolt.eu/ride/?lat=${lat}&lng=${lon}`;
    window.open(url, '_blank');
    sendNotification('Ride App Opened', `Opening ${provider === 'uber' ? 'Uber' : 'Bolt'}...`);
    setShowBookRide(false);
  };

  const handleFlightArrival = (num) => {
    setStatus('Checking Arrival Status...');
    setTimeout(async () => {
      const isMine = flightMonitoring.isMine;
      const arrivalMsg = isMine 
        ? "Welcome to your destination! You've successfully arrived."
        : `Flight ${num} has arrived at its destination. I've updated your record.`;
      
      const newMsg = { id: Date.now().toString() + '-arrival', role: 'assistant', content: arrivalMsg, timestamp: Date.now() };
      
      setMessages(prev => {
        const next = [...prev, newMsg];
        // Agentic Offline Update: Sync to Supabase even if user isn't looking
        if (user) {
          supabase.from('files').upsert({
            id: currentSessionId,
            user_id: user.id,
            type: 'session',
            content: next,
            metadata: { name: currentSessionName, timestamp: Date.now() }
          }).then();
        }
        return next;
      });

      speak(arrivalMsg, personality);
      
      if (isMine && wantsArrivalRide) {
        setTimeout(() => {
          setShowBookRide(true);
          setSelectedRideProvider(null);
        }, 2000);
      }

      sendNotification('Arrival', `Flight ${num} has arrived safely.`, { 
        type: 'flight_status',
        sessionId: currentSessionId 
      });
      
      // Agentic Email Notification Logic
      if (notificationToggles.meEmail && user?.email) {
        sendEmail({
          to: user.email,
          subject: `ARC Arrival Alert: Flight ${num}`,
          html: `<strong>Welcome home!</strong><p>Your flight ${num} has arrived safely at its destination.</p>`
        });
      }

      if (notificationToggles.emergencyEmail && emergencyContacts.length > 0) {
        const recipients = emergencyContacts.map(c => c.email);
        sendEmail({
          to: recipients,
          subject: `ARC Flight Alert: ${user?.email?.split('@')[0]} has arrived`,
          html: `<p>This is an automated update from ARC. The flight ${num} being monitored for ${user?.email} has arrived safely.</p>`
        });
      }

      setStatus('Ready');
    }, 2000);
  };

  const handleFlightContactChoice = (choice) => {
    if (choice === 'none') {
      setSelectedContactsForFlight([]);
      askAboutArrivalRide("Understood. I won't notify anyone.");
    } else if (choice === 'all') {
      setSelectedContactsForFlight(emergencyContacts);
      askAboutArrivalRide(`Great. I'll notify everyone in your emergency contacts list.`);
    } else if (choice === 'not_all') {
      setActiveFlightStep('contact_name');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Who should I notify? Please provide the name of the emergency contact first.", timestamp: Date.now() }]);
    }
  };

  const askAboutArrivalRide = (prefix = "") => {
    const question = `${prefix} Would you like to book a ride on arrival?`;
    const assistantMsg = {
      id: `msg-ride-ask-${Date.now()}`,
      role: 'assistant', 
      content: question, 
      type: 'flight_ride_ask',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantMsg]);
    speak(question, personality);
    setActiveFlightStep('book_ride_ask');
  };

  const handleFlightRideChoice = (choice) => {
    const choiceId = `msg-choice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (choice === 'yes') {
      setWantsArrivalRide(true);
      const msg = "Perfect. I will notify you and present ride options upon arrival.";
      setMessages(prev => [...prev, { id: choiceId, role: 'assistant', content: msg, timestamp: Date.now() }]);
      speak(msg, personality);
    } else {
      setWantsArrivalRide(false);
      const msg = "Understood. Have a good flight and safe travels!";
      setMessages(prev => [...prev, { id: choiceId, role: 'assistant', content: msg, timestamp: Date.now() }]);
      speak(msg, personality);
    }
    setActiveFlightStep(null);
  };

  const handleWeatherSearch = async (location) => {
    if (!location?.trim()) return;
    setIsWeatherSearching(true);
    setStatus(`Checking weather for ${location}...`);
    try {
      const res = await fetchWeather(location);
      if (res.success) {
        setWeatherData(res.data);
        setActiveTool('Weather');
        return res.data;
      } else {
        console.error('Weather error:', res.error);
        setMessages(prev => [...prev, { 
          id: `err-${Date.now()}`, 
          role: 'assistant', 
          content: `I couldn't find weather info for "${location}". Please check the city name.`,
          timestamp: Date.now() 
        }]);
        return null;
      }
    } catch (err) {
      console.error('Weather Search Exception:', err);
      return null;
    } finally {
      setIsWeatherSearching(false);
      setStatus('Ready');
    }
  };

  const executeBackgroundTask = async (userTranscription, aiResponse) => {
    const text = (userTranscription + " " + aiResponse).toLowerCase();
    if (text.includes('switch to gabby')) { setPersonality('Gabby'); return " [Switched to Gabby]"; }
    if (text.includes('switch to jenny')) { setPersonality('Jenny'); return " [Switched to Jenny]"; }
    
    // Agentic tool triggers
    if (text.includes('book a ride') || text.includes('uber') || text.includes('bolt')) {
      const provider = text.includes('bolt') ? 'bolt' : 'uber';
      const destinationMatch = text.match(/(?:to|at|in)\s+([a-zA-Z\s,]+)(?:\s|$)/);
      if (destinationMatch && destinationMatch[1]) {
        const dest = destinationMatch[1].trim();
        setRideDestination(dest);
        setSelectedRideProvider(provider);
        const coords = await geocodeDestination(dest);
        if (coords) {
          const docMsg = { 
            id: `doc-${Date.now()}`, 
            role: 'assistant', 
            content: `Autonomous Action: Initiated ${provider} booking to ${dest}.`,
            timestamp: Date.now() 
          };
          setMessages(prev => [...prev, docMsg]);
          setShowBookRide(true);
          if (text.includes('now') || text.includes('instantly')) {
            openRideApp(provider, coords);
          }
          return ` [Success: ${provider} to ${dest} initiated]`;
        }
        return ` [Error: Could not find location ${dest}]`;
      }
      setShowBookRide(true);
      return " [Opening Ride Booking Interface]";
    }

    if (text.includes('flight') && (text.includes('track') || text.includes('monitor') || text.match(/[a-z]{2}\d{2,4}/i))) {
      const flightMatch = text.match(/[a-z]{2}\d{2,4}/i);
      if (flightMatch) {
        const num = flightMatch[0].toUpperCase();
        setFlightNumber(num);
        const isMine = !text.includes('friend') && !text.includes('mom') && !text.includes('dad') && !text.includes('someone') && !text.includes('his') && !text.includes('her') && !text.includes('their');
        const status = await trackFlight(num, isMine);
        return ` [Autonomous Action: Tracking flight ${num}. Status: ${status.status}]`;
      }
      setShowFlightTracker(true);
      return " [Opening Flight Tracker]";
    }

    if (text.includes('weather')) {
      const locationMatch = text.match(/(?:in|at|for)\s+([a-zA-Z\s,]+)(?:\s|$)/);
      const location = locationMatch ? locationMatch[1].trim() : 'London';
      
      const data = await handleWeatherSearch(location);
      if (data) {
        return ` [Weather for ${location}: ${data.temp}°F, ${data.condition}]`;
      }
      return ` [Failed to fetch weather for ${location}]`;
    }

    return "";
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim() || !user) return;
    setStatus('Sending...');
    try {
      const { error } = await supabase.from('feedback').insert([{
        user_id: user.id,
        username: user.email.split('@')[0],
        email: user.email,
        content: feedbackText
      }]);
      if (error) throw error;
      setFeedbackText('');
      setShowFeedback(false);
      setStatus('Ready');
      alert('Feedback sent! Thank you.');
    } catch (err) {
      console.error('Feedback Error:', err);
      alert('Failed to send feedback.');
      setStatus('Ready');
    }
  };

  const trackFlight = async (num, isMine = true) => {
    setStatus('Tracking Flight...');
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockStatus = {
          active: true,
          number: num,
          status: 'On Time',
          departure: '10:30 AM',
          arrival: '2:45 PM',
          lastUpdate: new Date().toLocaleTimeString(),
          isMine
        };
        setFlightMonitoring(mockStatus);
        
        const aiResponse = isMine 
          ? `I've started monitoring your flight ${num}. It's currently ${mockStatus.status}. I'll welcome you upon arrival!`
          : `I've started monitoring flight ${num} for your contact. I'll keep you updated.`;

        setMessages(prev => [...prev, { id: `msg-flight-${Date.now()}`, role: 'assistant', content: aiResponse, timestamp: Date.now() }]);
        speak(aiResponse, personality);
        setStatus('Ready');
        
        if (isMine) {
          setTimeout(() => handleFlightArrival(num), 30000);
        }
        resolve(mockStatus);
      }, 1500);
    });
  };

  const getAIResponse = async (userText, overridePersonality = null) => {
    setStatus('Thinking...');
    setIsProcessing(true);
    try {
      const activePersonality = overridePersonality || personality;
      const systemContext = `You are ${activePersonality}, a premium autonomous reasoning companion (ARC).
        You are highly intelligent, proactive, and capable of complex reasoning.
        Current mode: ${isDualMode ? 'Dual Conversation with another agent' : 'Single mode'}.
        
        Guidelines:
        - Be concise but extremely helpful.
        - Use your tools (weather, flight tracking, ride booking) proactively when relevant.
        - Maintain a sophisticated, professional, yet approachable tone.
        - If in Dual mode, coordinate with the other agent to provide a comprehensive perspective.
        - Never repeat yourself or the other agent.
        - Focus on "Real Actions" - if a user mentions a need, offer to use a tool or document it.`;
      
      const { success, data: memories } = await searchMemory(userText);
      const memoryPrompt = success && memories?.length > 0 
        ? "\nRelevant context from memory: " + memories.map(m => m.content).join(' ') : "";

      const historyMessages = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const apiMessages = [
        { role: 'system', content: systemContext + memoryPrompt },
        ...historyMessages,
        { role: 'user', content: userText }
      ];

      const aiText = await getOpenRouterResponse(apiMessages);
      const taskResult = await executeBackgroundTask(userText, aiText);
      
      setIsProcessing(false);
      setStatus('Ready');
      return (aiText + taskResult).trim().replace(/\s+/g, ' ');
    } catch (err) {
      setIsProcessing(false);
      setStatus('Error');
      return "I'm experiencing a temporary connection issue. Please try again in a moment.";
    }
  };

  const handleSendMessage = async (textOverride) => {
    const text = textOverride || inputText;
    if (!text.trim() || isProcessing) return;

    console.log('Sending message:', text);

    // Alexa-style: Pause listening while processing/speaking
    const wasListening = isSessionActive;
    if (wasListening) {
      console.log('Pausing listening for processing...');
      stopListening();
    }

    const userMsg = { 
      id: `msg-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user', 
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Voice command checks
    const lowerText = text.toLowerCase();
    if (lowerText.includes('turn on dual conversation')) {
      setIsDualMode(true);
      const resp = "Dual conversation is on.";
      const assistantMsg = { id: Date.now().toString(), role: 'assistant', content: resp, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      await speak(resp);
      if (wasListening) {
        console.log('Resuming listening after dual mode toggle...');
        startListening();
      }
      return;
    }
    if (lowerText.includes('turn off dual conversation')) {
      setIsDualMode(false);
      const resp = "Dual conversation is off.";
      const assistantMsg = { id: Date.now().toString(), role: 'assistant', content: resp, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      await speak(resp);
      if (wasListening) {
        console.log('Resuming listening after dual mode toggle...');
        startListening();
      }
      return;
    }

    try {
      if (isDualMode) {
        console.log('Dual mode active, getting responses from both agents...');
        setIsVoiceEnabled(true); // Voice must be on in Dual mode
        
        const respJenny = await getAIResponse(text, 'Jenny');
        const jennyMsg = { id: `jenny-${Date.now()}`, role: 'assistant', content: respJenny, personality: 'Jenny', timestamp: Date.now() };
        setMessages(prev => [...prev, jennyMsg]);
        console.log('Jenny responding...');
        await speak(respJenny, 'Jenny');

        const respGabby = await getAIResponse(text, 'Gabby');
        const gabbyMsg = { id: `gabby-${Date.now()}`, role: 'assistant', content: respGabby, personality: 'Gabby', timestamp: Date.now() };
        setMessages(prev => [...prev, gabbyMsg]);
        console.log('Gabby responding...');
        await speak(respGabby, 'Gabby');
      } else {
        const aiText = await getAIResponse(text);
        const assistantMsg = {
          id: `msg-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: aiText,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);
        console.log('Assistant responding...');
        await speak(aiText, personality);
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      setStatus('Error');
    } finally {
      // Alexa-style: Resume listening if session is still active
      if (wasListening && isSessionActiveRef.current) {
        console.log('Processing complete, resuming continuous listening...');
        startListening();
      }
    }
  };

  const sendNotification = (title, message, payload = {}) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      payload,
      timestamp: new Date().toLocaleTimeString(),
      isRead: false,
      icon: payload.type === 'flight_status' ? 'Plane' : (payload.type?.includes('youtube') ? 'Youtube' : 'Bell')
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  // Sync sessions with Supabase
  useEffect(() => {
    const syncSession = async () => {
      if (user && messages.length > 0) {
        try {
          const { error } = await supabase
            .from('files')
            .upsert({
              id: currentSessionId,
              user_id: user.id,
              type: 'session',
              content: messages,
              metadata: { 
                name: currentSessionName, 
                timestamp: Date.now(),
                user_email: user.email 
              }
            }, { onConflict: 'id' });
          
          if (error) throw error;
          console.log('Session synced to Supabase successfully.');
        } catch (err) {
          console.error('Error syncing session to Supabase:', err);
        }
      }
    };

    const timeoutId = setTimeout(syncSession, 1000); // Faster sync
    return () => clearTimeout(timeoutId);
  }, [messages, currentSessionId, currentSessionName, user]);

  const handleNotificationClick = (n) => {
    setShowNotifications(false);
    if (n.payload?.sessionId) {
      const session = sessions.find(s => s.id === n.payload.sessionId);
      if (session) {
        setMessages(session.messages);
        setCurrentSessionId(session.id);
        setCurrentSessionName(session.name);
      }
    } else if (n.payload?.type?.includes('youtube')) { 
      setHistoryFilter('Files'); 
      setShowHistory(true); 
    } else if (n.payload?.type === 'flight_status') {
      setShowFlightTracker(true);
    }
  };

  const createNewSession = () => {
    setMessages([]);
    setCurrentSessionId(Date.now().toString());
    setCurrentSessionName(`Session ${new Date().toLocaleTimeString()}`);
    setShowHistory(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    setSessionToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (currentSessionId === sessionToDelete) {
        setMessages([]);
        setCurrentSessionId(Date.now().toString());
        setCurrentSessionName(`Session ${new Date().toLocaleTimeString()}`);
      }
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    }
  };

  const saveCurrentSession = () => {
    if (messages.length === 0) return;
    
    const sessionToSave = {
      id: currentSessionId,
      name: currentSessionName,
      messages: [...messages],
      timestamp: Date.now()
    };

    setSessions(prev => {
      const exists = prev.find(s => s.id === currentSessionId);
      if (exists) {
        return prev.map(s => s.id === currentSessionId ? sessionToSave : s);
      }
      return [sessionToSave, ...prev];
    });
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-navy-900">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Initializing ARC...</p>
      </div>
    );
  }

  // Render Landing Page
  const [authView, setAuthView] = useState(() => {
    return localStorage.getItem('authView') || 'login';
  });

  useEffect(() => {
    localStorage.setItem('authView', authView);
  }, [authView]);

  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      alert('Please fill in all fields.');
      return;
    }
    setStatus('Signing In...');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      
      // Clear local cache on successful login to force Supabase sync
      localStorage.removeItem('sessions');
      localStorage.removeItem('currentMessages');
      setMessages([]);
      setCurrentView('chat');
    } catch (err) {
      alert(err.message);
    }
    setStatus('Ready');
  };

  const handleSignup = async () => {
    if (!authEmail || !authPassword || !authName) {
      alert('Please fill in all fields.');
      return;
    }
    setStatus('Creating Account...');
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            full_name: authName,
          },
        },
      });
      if (error) throw error;
      alert('Check your email for the confirmation link!');
      setAuthView('login');
    } catch (err) {
      alert(err.message);
    }
    setStatus('Ready');
  };

  const handleForgotPassword = async () => {
    if (!authEmail) {
      alert('Please enter your email first.');
      return;
    }
    setStatus('Sending Reset...');
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      alert(error.message);
    } else {
      alert('Password reset link sent to your email!');
      setAuthView('login');
    }
    setStatus('Ready');
  };

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-navy-900 transition-colors duration-500 overflow-hidden relative">
        {/* Abstract background elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
        
        {/* Navigation */}
        <nav className="flex justify-between items-center px-8 py-6 z-10">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-white/10">
              <img src="/assets/images/logo.svg" alt="ARC Logo" className="w-full h-full object-contain" onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://ui-avatars.com/api/?name=A&background=000&color=fff';
              }} />
            </div>
            <span className="text-2xl font-black tracking-tighter dark:text-white">ARC</span>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 transition-all">
            {isDarkMode ? <Sun className="text-yellow-400" /> : <Moon className="text-navy-900" />}
          </button>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center z-10 max-w-4xl mx-auto">
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest">
              Autonomous Reasoning Companion
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tightest dark:text-white leading-[0.9]">
              From flight updates to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 uppercase">Real Actions.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">
              Track flight, get alert, and take action instantly.
            </p>
          </div>

          <div className="w-full max-w-sm mt-16 flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-10 delay-300 duration-1000 fill-mode-both">
            <button 
              onClick={() => setCurrentView('signup')} 
              className="group relative w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xl shadow-2xl shadow-blue-500/25 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              Get Started
            </button>
            <button 
              onClick={() => setCurrentView('signin')} 
              className="w-full py-5 border-2 border-slate-200 dark:border-slate-800 dark:text-white rounded-2xl font-bold text-xl hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"
            >
              Sign In
            </button>
          </div>
        </div>

      </div>
    );
  }

  // Render Auth Pages
  if (currentView === 'signin' || currentView === 'signup') {
    return (
      <div className="min-h-screen p-8 pt-16 bg-white dark:bg-navy-900 transition-colors">
        <button onClick={() => setCurrentView('landing')} className="mb-8 dark:text-white p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-all"><ArrowLeft /></button>
        
        {authView === 'login' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-4xl font-black dark:text-white mb-2">Welcome Back</h2>
            <p className="text-slate-500 mb-10">Sign in to continue to ARC</p>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Mail className="text-slate-400 mr-4" />
                <input type="email" placeholder="Email Address" className="bg-transparent outline-none w-full dark:text-white" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
              </div>
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Lock className="text-slate-400 mr-4" />
                <input type="password" placeholder="Password" className="bg-transparent outline-none w-full dark:text-white" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
              </div>
              <button onClick={() => setAuthView('forgot_password')} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2">Forgotten Password?</button>
              <button onClick={handleLogin} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg mt-4 shadow-lg shadow-blue-500/25">Sign In</button>
              <button onClick={() => setAuthView('signup')} className="w-full text-center text-blue-600 font-bold mt-4">Don't have an account? Sign Up</button>
            </div>
          </div>
        ) : authView === 'forgot_password' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-4xl font-black dark:text-white mb-2">Reset Password</h2>
            <p className="text-slate-500 mb-10">Enter your email to receive a recovery link.</p>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Mail className="text-slate-400 mr-4" />
                <input type="email" placeholder="Email Address" className="bg-transparent outline-none w-full dark:text-white" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
              </div>
              <button onClick={handleForgotPassword} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg mt-4 shadow-lg shadow-blue-500/25">Send Reset Link</button>
              <button onClick={() => setAuthView('login')} className="w-full text-center text-slate-500 font-bold mt-4">Back to Login</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-4xl font-black dark:text-white mb-2">Create Account</h2>
            <p className="text-slate-500 mb-10">Join the futuristic reasoning companion</p>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <User className="text-slate-400 mr-4" />
                <input type="text" placeholder="Full Name" className="bg-transparent outline-none w-full dark:text-white" value={authName} onChange={e => setAuthName(e.target.value)} />
              </div>
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Mail className="text-slate-400 mr-4" />
                <input type="email" placeholder="Email Address" className="bg-transparent outline-none w-full dark:text-white" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
              </div>
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Lock className="text-slate-400 mr-4" />
                <input type="password" placeholder="Password" className="bg-transparent outline-none w-full dark:text-white" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
              </div>
              <button onClick={handleSignup} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg mt-4 shadow-lg shadow-blue-500/25">Sign Up</button>
              <button onClick={() => setAuthView('login')} className="w-full text-center text-blue-600 font-bold mt-4">Already have an account? Sign In</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Chat View
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-navy-900 transition-colors">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
            <img src="/assets/images/logo.svg" alt="ARC Logo" className="w-full h-full object-contain" onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://ui-avatars.com/api/?name=A&background=000&color=fff';
            }} />
          </div>
          <div>
            <h1 className="text-2xl font-black dark:text-white leading-none">ARC</h1>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">Autonomous Reasoning Companion</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setShowHistory(true)} className="dark:text-white"><Folder /></button>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="dark:text-white"><Bell /></button>
            {notifications.some(n => !n.isRead) && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-navy-900 text-[8px] flex items-center justify-center text-white font-bold">{notifications.filter(n => !n.isRead).length}</span>}
          </div>
          <button onClick={() => setIsDualMode(!isDualMode)} className={`p-2 rounded-xl transition-all ${isDualMode ? 'bg-purple-600 text-white' : 'text-slate-400'}`}><Layers size={20} /></button>
          <button onClick={() => setPersonality(p => p === 'Jenny' ? 'Gabby' : 'Jenny')} className={`text-xs font-black uppercase tracking-widest ${personality === 'Jenny' ? 'text-blue-500' : 'text-pink-500'}`}>
            {isDualMode ? 'Dual' : personality}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {/* Quick Tools */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center space-y-4">
          {showQuickTools && (
            <div className="bg-slate-900/90 p-2 rounded-3xl flex flex-col space-y-2 animate-in fade-in zoom-in">
              <button onClick={() => { setShowBookRide(true); setShowQuickTools(false); }} className="p-3 bg-white/10 rounded-full text-blue-500" title="Book Ride"><Car size={20} /></button>
              <button onClick={() => { setShowFlightTracker(true); setShowQuickTools(false); }} className="p-3 bg-white/10 rounded-full text-emerald-500" title="Flight Tracker"><Plane size={20} /></button>
              <button onClick={() => { 
                if (!weatherData) {
                  // Trigger weather check for default location if none exists
                  const defaultLoc = 'London';
                  setStatus(`Checking weather for ${defaultLoc}...`);
                  fetchWeather(defaultLoc).then(res => {
                    if (res.success) setWeatherData(res.data);
                    setStatus('Ready');
                  });
                }
                setActiveTool('Weather'); 
                setShowQuickTools(false); 
              }} className="p-3 bg-white/10 rounded-full text-yellow-500" title="Weather"><CloudSun size={20} /></button>
            </div>
          )}
          <button onClick={() => setShowQuickTools(!showQuickTools)} className="p-4 bg-slate-800 text-white rounded-full shadow-xl"><LayoutGrid /></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollViewRef}>
          {messages.length === 0 && !isRecording && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
              <div className="p-6 bg-slate-100 dark:bg-navy-800 rounded-full"><MessageSquare size={48} /></div>
              <p className="italic font-medium">{personality === 'Jenny' ? "Jenny is ready for tasks." : "Gabby is here to chat."}</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id || `msg-${msg.timestamp || Date.now()}-${Math.random()}`} className={`max-w-[85%] p-4 rounded-3xl ${msg.role === 'user' ? 'ml-auto bg-blue-600 text-white rounded-br-none' : 'mr-auto bg-slate-100 dark:bg-navy-800 dark:text-white rounded-bl-none'}`}>
              <span className="text-[10px] font-black uppercase opacity-60 mb-1 block">
                {msg.role === 'user' ? 'You' : (isDualMode ? (msg.personality || 'Agent') : personality)}
              </span>
              <p className="text-sm leading-relaxed">{msg.content}</p>
              
              {msg.type === 'flight_contacts_choice' && (
                <div className="flex space-x-2 mt-4">
                  <button onClick={() => handleFlightContactChoice('not_all')} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-xs font-bold">Not All</button>
                  <button onClick={() => handleFlightContactChoice('none')} className="flex-1 py-2 bg-slate-500 text-white rounded-xl text-xs font-bold">None</button>
                  <button onClick={() => handleFlightContactChoice('all')} className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold">All</button>
                </div>
              )}
              {msg.type === 'flight_ride_ask' && (
                <div className="flex space-x-2 mt-4">
                  <button onClick={() => handleFlightRideChoice('yes')} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Yes</button>
                  <button onClick={() => handleFlightRideChoice('no')} className="flex-1 py-2 bg-slate-500 text-white rounded-xl text-xs font-bold">No</button>
                </div>
              )}
              {msg.type === 'flight_arrival_ride_options' && (
                <div className="flex space-x-2 mt-4">
                  <button onClick={() => { setShowBookRide(true); setSelectedRideProvider(null); }} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Book Ride Now</button>
                </div>
              )}
            </div>
          ))}

          {isRecording && currentTranscription && (
            <div className="max-w-[85%] ml-auto p-4 bg-blue-600/70 text-white rounded-3xl rounded-br-none italic">
              <span className="text-[10px] font-black uppercase opacity-60 mb-1 block">Listening...</span>
              {currentTranscription}
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="p-6 flex flex-col items-center space-y-4">
          <div className="flex flex-col items-center">
            <button onClick={toggleSession} className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${isSessionActive ? 'bg-red-500 scale-110' : 'bg-blue-600'}`}>
              {isSessionActive ? <Square fill="currentColor" /> : <Mic size={32} />}
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest mt-3 text-slate-400">{isSessionActive ? 'Stop' : 'Start Talking'}</span>
          </div>

          <div className="w-full flex items-center p-3 bg-slate-100 dark:bg-navy-800 rounded-full border border-slate-200 dark:border-navy-700">
            <input type="text" placeholder="Type your command..." className="flex-1 bg-transparent outline-none px-4 dark:text-white" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
            <button onClick={() => handleSendMessage()} className="p-2 text-blue-600"><Send /></button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-2 bg-slate-50 dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 flex justify-between items-center text-[10px] font-bold text-slate-400">
          <div className="flex items-center">
            {isSessionActive && <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />}
            {status}
          </div>
          <div className="uppercase tracking-widest">{isDualMode ? 'Dual Mode' : `${personality} Mode`}</div>
        </div>
      </main>

      {/* Modals - Simplified for Web */}
      {showNotifications && (
        <div className="absolute top-20 left-6 right-6 max-h-[60%] bg-white dark:bg-navy-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col border border-slate-100 dark:border-navy-700">
          <div className="p-4 border-b border-slate-100 dark:border-navy-700 flex justify-between items-center">
            <h3 className="font-black dark:text-white">Notifications</h3>
            <button onClick={() => setNotifications([])} className="text-[10px] text-blue-500 uppercase font-black">Clear All</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {notifications.map(n => (
              <div key={n.id} onClick={() => handleNotificationClick(n)} className="p-3 bg-slate-50 dark:bg-navy-900/50 rounded-2xl flex items-center cursor-pointer">
                <div className="w-10 h-10 bg-blue-100 dark:bg-navy-800 rounded-full flex items-center justify-center mr-3 text-blue-600"><Bell size={18} /></div>
                <div className="flex-1">
                  <p className="text-xs font-bold dark:text-white">{n.title}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{n.message}</p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && <div className="p-10 text-center text-slate-400 italic text-sm">No notifications</div>}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="absolute inset-0 top-20 bg-white dark:bg-navy-900 z-50 p-6 flex flex-col rounded-t-[40px] shadow-2xl border-t border-slate-100 dark:border-navy-800">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-black dark:text-white">Knowledge Base</h2>
            <div className="flex space-x-4">
              <button onClick={() => setShowSettings(true)} className="dark:text-white"><Settings /></button>
              <button onClick={() => setShowHistory(false)} className="text-red-500"><PlusCircle className="rotate-45" /></button>
            </div>
          </div>
          <div className="flex space-x-2 mb-8">
            <button onClick={createNewSession} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center space-x-2"><PlusCircle size={20} /><span>New Session</span></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Saved Sessions</h3>
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setMessages(s.messages); setCurrentSessionId(s.id); setCurrentSessionName(s.name); setShowHistory(false); }} className="p-4 bg-slate-50 dark:bg-navy-800 rounded-2xl flex items-center cursor-pointer group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                <div className="w-12 h-12 bg-blue-100 dark:bg-navy-700 rounded-full flex items-center justify-center text-blue-600 mr-4 group-hover:scale-110 transition-transform"><Folder size={24} /></div>
                <div className="flex-1">
                  <p className="font-bold dark:text-white">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.messages.length} messages • {new Date(s.timestamp).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={(e) => deleteSession(e, s.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  <ChevronRight className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-navy-800 rounded-[40px] p-8 animate-in zoom-in duration-300 relative shadow-2xl border border-slate-100 dark:border-navy-700 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black dark:text-white leading-none">Settings</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">System Configuration</p>
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSettings(false);
                }} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full transition-colors group"
              >
                <X size={28} className="text-slate-400 group-hover:text-red-500 transition-colors" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Preferences</h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl">
                  <div className="flex items-center space-x-3"><Moon className="text-blue-500" size={20} /><span className="font-bold dark:text-white">Dark Mode</span></div>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-12 h-6 rounded-full transition-all relative ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} /></button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl">
                  <div className="flex items-center space-x-3"><Volume2 className="text-blue-500" size={20} /><span className="font-bold dark:text-white">Voice Response</span></div>
                  <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`w-12 h-6 rounded-full transition-all relative ${isVoiceEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isVoiceEnabled ? 'right-1' : 'left-1'}`} /></button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl">
                  <div className="flex items-center space-x-3"><Mail className="text-blue-500" size={20} /><span className="font-bold dark:text-white">Notify Me with Email</span></div>
                  <button onClick={() => {
                    if (!userEmail) {
                      setShowEmailPopup(true);
                      return;
                    }
                    setNotificationToggles({ ...notificationToggles, meEmail: !notificationToggles.meEmail });
                  }} className={`w-12 h-6 rounded-full transition-all relative ${notificationToggles.meEmail ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationToggles.meEmail ? 'right-1' : 'left-1'}`} /></button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl">
                  <div className="flex items-center space-x-3"><Bell className="text-blue-500" size={20} /><span className="font-bold dark:text-white">Push Notifications</span></div>
                  <button 
                    onClick={() => {
                      const OneSignal = window.OneSignal || [];
                      OneSignal.push(() => {
                        OneSignal.showNativePrompt();
                      });
                    }} 
                    className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-700 transition-all"
                  >
                    Enable
                  </button>
                </div>
              </section>

              <section className="space-y-4">
                <button 
                  onClick={() => setIsEmergencyCollapsed(!isEmergencyCollapsed)}
                  className="w-full flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-blue-500 transition-colors"
                >
                  <span>Emergency Contacts</span>
                  <ChevronRight className={`transition-transform duration-300 ${!isEmergencyCollapsed ? 'rotate-90' : ''}`} size={16} />
                </button>
                
                {!isEmergencyCollapsed && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <button 
                      onClick={() => setShowAddContactModal(true)} 
                      className="w-full p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl flex items-center justify-between font-bold dark:text-white border-2 border-dashed border-slate-200 dark:border-navy-700 hover:border-blue-500 transition-colors"
                    >
                      <span>Add Email</span>
                      <PlusCircle size={20} className="text-blue-500" />
                    </button>
                    {emergencyContacts.map((c, i) => (
                      <div key={i} className="p-3 ml-4 border-l-2 border-blue-500 bg-slate-50 dark:bg-navy-900/30 rounded-r-xl">
                        <p className="text-sm font-bold dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Support</h3>
                <button 
                  onClick={() => setShowFeedback(true)}
                  className="w-full p-4 bg-slate-50 dark:bg-navy-900/50 rounded-2xl flex items-center justify-between font-bold dark:text-white border border-slate-100 dark:border-navy-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <MessageSquare size={20} className="text-blue-500" />
                    <span>Send Feedback</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </section>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all"
                >
                  Done
                </button>
                <button onClick={async () => { 
                  await supabase?.auth.signOut();
                  setCurrentView('landing'); 
                  setShowSettings(false); 
                }} className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl font-bold flex items-center justify-center space-x-2"><LogOut size={20} /><span>Sign Out</span></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-navy-800 rounded-[32px] p-8 space-y-6 animate-in zoom-in duration-300 shadow-2xl border border-slate-100 dark:border-navy-700">
            <h2 className="text-2xl font-black dark:text-white">Feedback</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tell us how we can improve ARC.</p>
            <textarea 
              className="w-full h-32 p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus:border-blue-500 outline-none text-sm dark:text-white resize-none"
              placeholder="Write your feedback here..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setShowFeedback(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-navy-900 rounded-2xl transition-colors">Cancel</button>
              <button onClick={handleFeedbackSubmit} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Send</button>
            </div>
          </div>
        </div>
      )}

      {activeTool === 'Weather' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-navy-800 rounded-[32px] p-8 space-y-6 animate-in zoom-in duration-300 shadow-2xl border border-slate-100 dark:border-navy-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black dark:text-white">Weather</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time Forecast</p>
              </div>
              <button onClick={() => { setActiveTool(null); setWeatherSearchQuery(''); }} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-900 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
            </div>

            {/* Weather Search Interface */}
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus-within:border-blue-500 transition-colors">
                <Search className="text-slate-400 mr-4" size={20} />
                <input 
                  type="text" 
                  placeholder="Search City..." 
                  className="bg-transparent outline-none w-full dark:text-white font-medium" 
                  value={weatherSearchQuery}
                  onChange={(e) => setWeatherSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWeatherSearch(weatherSearchQuery)}
                />
                {isWeatherSearching && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-2" />}
              </div>
              <button 
                onClick={() => handleWeatherSearch(weatherSearchQuery)}
                disabled={isWeatherSearching || !weatherSearchQuery.trim()}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                {isWeatherSearching ? 'Searching...' : 'Check Weather'}
              </button>
            </div>
            
            {weatherData ? (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col items-center py-6 space-y-4">
                  {weatherData.icon ? (
                    <img src={`https://openweathermap.org/img/wn/${weatherData.icon}@4x.png`} alt={weatherData.condition} className="w-32 h-32" />
                  ) : (
                    <Sun size={64} className="text-yellow-400 animate-pulse" />
                  )}
                  <div className="text-center">
                    <p className="text-5xl font-black dark:text-white">{weatherData.temp}°F</p>
                    <p className="font-bold text-slate-500 uppercase tracking-widest mt-2">{weatherData.condition} • {weatherData.location}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-navy-900/50 rounded-2xl text-center border border-slate-100 dark:border-navy-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Wind</p>
                    <p className="font-bold dark:text-white">{weatherData.wind}mph</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-navy-900/50 rounded-2xl text-center border border-slate-100 dark:border-navy-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Humid</p>
                    <p className="font-bold dark:text-white">{weatherData.humidity}%</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-navy-900/50 rounded-2xl text-center border border-slate-100 dark:border-navy-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Condition</p>
                    <p className="font-bold dark:text-white text-[10px] truncate">{weatherData.description}</p>
                  </div>
                </div>
              </div>
            ) : !isWeatherSearching && (
              <div className="py-10 text-center opacity-40 italic text-slate-500">
                Enter a city name to see the forecast
              </div>
            )}
            
            <button onClick={() => { setActiveTool(null); setWeatherSearchQuery(''); }} className="w-full py-4 border-2 border-slate-100 dark:border-navy-700 dark:text-white rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-navy-900 transition-all">Close</button>
          </div>
        </div>
      )}

      {showBookRide && (
        <div className="absolute inset-0 bg-black/50 z-[60] flex items-end">
          <div className="w-full bg-white dark:bg-navy-800 rounded-t-[40px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black dark:text-white">Book a Ride</h2>
              <button onClick={() => { setShowBookRide(false); setSelectedRideProvider(null); }} className="text-slate-300"><X size={32} /></button>
            </div>
            
            {!selectedRideProvider ? (
              <div className="space-y-6">
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-center">Select your preferred provider</p>
                <p className="text-xs text-center text-slate-400">Please ensure the selected app is installed on your device.</p>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setSelectedRideProvider('uber')} 
                    className="flex-1 flex flex-col items-center justify-center py-8 bg-black text-white rounded-3xl space-y-3 hover:scale-[1.02] transition-transform"
                  >
                    <Car size={40} />
                    <span className="font-black uppercase tracking-widest text-sm">Uber</span>
                  </button>
                  <button 
                    onClick={() => setSelectedRideProvider('bolt')} 
                    className="flex-1 flex flex-col items-center justify-center py-8 bg-emerald-500 text-white rounded-3xl space-y-3 hover:scale-[1.02] transition-transform"
                  >
                    <Car size={40} />
                    <span className="font-black uppercase tracking-widest text-sm">Bolt</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-navy-900/50 p-3 rounded-2xl">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedRideProvider === 'uber' ? 'bg-black text-white' : 'bg-emerald-500 text-white'}`}>
                    <Car size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400">Selected Provider</p>
                    <p className="text-sm font-bold dark:text-white capitalize">{selectedRideProvider}</p>
                  </div>
                  <button onClick={() => setSelectedRideProvider(null)} className="ml-auto text-xs text-blue-600 font-bold">Change</button>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 font-medium ml-1">Where would you like to go?</p>
                  <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus-within:border-blue-500 transition-colors">
                    <MapPin className="text-slate-400 mr-4" />
                    <input 
                      type="text" 
                      placeholder="Enter Destination" 
                      className="bg-transparent outline-none w-full dark:text-white font-medium" 
                      value={rideDestination} 
                      onChange={e => setRideDestination(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && geocodeDestination(rideDestination).then(coords => coords && openRideApp(selectedRideProvider, coords))}
                    />
                  </div>
                </div>
                
                <button 
                  onClick={async () => { 
                    const coords = await geocodeDestination(rideDestination); 
                    if (coords) openRideApp(selectedRideProvider, coords); 
                  }} 
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all"
                >
                  Confirm & Open App
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showFlightTracker && (
        <div className="absolute inset-0 bg-black/50 z-[60] flex items-end">
          <div className="w-full bg-white dark:bg-navy-800 rounded-t-[40px] p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black dark:text-white">Flight Tracker</h2>
              <button onClick={() => setShowFlightTracker(false)} className="text-slate-300"><X size={32} /></button>
            </div>
            <p className="text-sm text-slate-500 font-medium">Enter flight number (e.g. AA123)</p>
            <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700">
              <Plane className="text-slate-400 mr-4" />
              <input type="text" placeholder="Flight Number" className="bg-transparent outline-none w-full dark:text-white uppercase" value={flightNumber} onChange={e => setFlightNumber(e.target.value.toUpperCase())} />
            </div>
            <button onClick={() => { if (flightNumber) { trackFlight(flightNumber); setShowFlightTracker(false); } }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg">Start Tracking</button>
            {flightMonitoring.active && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl">
                <p className="text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase mb-1">Monitoring: {flightMonitoring.number}</p>
                <p className="font-bold dark:text-white">Status: {flightMonitoring.status}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showEmailPopup && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-navy-800 rounded-[32px] p-8 space-y-6 animate-in zoom-in duration-300 shadow-2xl border border-slate-100 dark:border-navy-700">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Mail className="text-blue-600 w-8 h-8" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black dark:text-white">Email Setup</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Receive premium updates about your flights and rides directly in your inbox.</p>
            </div>
            <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus-within:border-blue-500 transition-colors">
              <Mail className="text-slate-400 mr-4" size={20} />
              <input 
                type="email" 
                placeholder="Your Email Address" 
                className="bg-transparent outline-none w-full dark:text-white text-sm font-medium" 
                value={userEmail} 
                onChange={e => setUserEmail(e.target.value)} 
              />
            </div>
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setShowEmailPopup(false)} 
                className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-navy-900 rounded-2xl transition-colors"
              >
                Later
              </button>
              <button 
                onClick={async () => {
                  if (userEmail.includes('@')) {
                    localStorage.setItem('userEmail', userEmail);
                    await saveUserEmail(userEmail);
                    setShowEmailPopup(false);
                  } else {
                    alert('Please enter a valid email.');
                  }
                }} 
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddContactModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-navy-800 rounded-[32px] p-8 space-y-6 animate-in zoom-in duration-300 shadow-2xl border border-slate-100 dark:border-navy-700">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black dark:text-white">Emergency Contact</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add someone to keep them posted on your travels.</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus-within:border-blue-500 transition-colors">
                <User className="text-slate-400 mr-4" size={20} />
                <input 
                  type="text" 
                  placeholder="Contact Name" 
                  className="bg-transparent outline-none w-full dark:text-white text-sm font-medium" 
                  value={newContactName} 
                  onChange={e => setNewContactName(e.target.value)} 
                />
              </div>
              
              <div className="flex items-center p-4 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-700 focus-within:border-blue-500 transition-colors">
                <Mail className="text-slate-400 mr-4" size={20} />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="bg-transparent outline-none w-full dark:text-white text-sm font-medium" 
                  value={newContactEmail} 
                  onChange={e => setNewContactEmail(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => {
                  setShowAddContactModal(false);
                  setNewContactName('');
                  setNewContactEmail('');
                }} 
                className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-navy-900 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (newContactName && newContactEmail.includes('@')) {
                    setEmergencyContacts([...emergencyContacts, { name: newContactName, email: newContactEmail }]);
                    setShowAddContactModal(false);
                    setNewContactName('');
                    setNewContactEmail('');
                  } else {
                    alert('Please provide both a name and a valid email.');
                  }
                }} 
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-navy-800 rounded-[32px] p-8 space-y-6 animate-in zoom-in duration-300 shadow-2xl border border-slate-100 dark:border-navy-700">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black dark:text-white text-red-500">Delete Session?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone. Are you sure you want to delete this session?</p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-navy-900 rounded-2xl transition-colors"
              >
                Keep it
              </button>
              <button 
                onClick={confirmDeleteSession} 
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPWAConfirm && (
        <div className="absolute bottom-8 left-6 right-6 md:left-auto md:right-8 md:w-80 bg-white dark:bg-navy-800 rounded-3xl p-6 shadow-2xl z-[100] border border-slate-100 dark:border-navy-700 animate-in slide-in-from-bottom-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex-shrink-0 flex items-center justify-center">
              <span className="text-white font-black text-xl">A</span>
            </div>
            <div className="flex-1">
              <h3 className="font-black dark:text-white leading-tight">Install ARC App</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get the premium experience on your home screen.</p>
              <div className="flex space-x-3 mt-4">
                <button onClick={() => setShowPWAConfirm(false)} className="text-xs font-bold text-slate-400">Not now</button>
                <button 
                  onClick={() => {
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      setShowPWAConfirm(false);
                    }
                  }} 
                  className="text-xs font-black text-blue-600 uppercase tracking-widest"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
