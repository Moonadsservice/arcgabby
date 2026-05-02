import { recordLatency, recordError } from './metrics';

const getGeminiKey = () => import.meta.env.VITE_GEMINI_API_KEY;
const getGroqKey = () => import.meta.env.VITE_GROQ_API_KEY;

const MAX_RETRIES = 3;
const INITIAL_DELAY = 10; // Reduced for tests
const TIMEOUT_MS = 5000;

const logRequest = (provider, url, body) => {
  console.log(`[${new Date().toISOString()}] AI Request to ${provider}:`, {
    url,
    payload: body,
  });
};

const logResponse = (provider, status, payload, latency) => {
  console.log(`[${new Date().toISOString()}] AI Response from ${provider} (${status}) in ${latency}ms:`, {
    payload,
  });
};

const fetchWithTimeout = async (url, options, timeout = TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (fetchFn, provider) => {
  let delay = INITIAL_DELAY;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const startTime = Date.now();
      const response = await fetchFn();
      const latency = Date.now() - startTime;
      recordLatency(latency);

      if (response.ok) {
        const data = await response.json();
        logResponse(provider, response.status, data, latency);
        return data;
      }
      
      const errorText = await response.text();
      logResponse(provider, response.status, errorText, latency);
      if (response.status >= 500 || response.status === 429) {
        // Retry on server errors or rate limits
        throw new Error(`Status ${response.status}`);
      }
      break; // Don't retry on 4xx other than 429
    } catch (err) {
      console.warn(`${provider} attempt ${i + 1} failed:`, err.message);
      if (i === MAX_RETRIES - 1) throw err;
      await wait(delay);
      delay *= 2;
    }
  }
};

/**
 * Optimised AI Response utility.
 * Prioritises Gemini for complex reasoning and Groq for speed fallback.
 */
export const getAIResponse = async (messages, persona = 'Jenny') => {
  const startTime = Date.now();
  const GEMINI_API_KEY = getGeminiKey();
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {
      throw new Error('Gemini API Key missing');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    };

    logRequest('Gemini', url, body);

    const data = await fetchWithRetry(() => fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }), 'Gemini');

    const content = data.candidates[0]?.content?.parts[0]?.text;
    if (content) return content;
    
    throw new Error('Empty response from Gemini');
  } catch (err) {
    recordError();
    console.warn('Gemini fallback to Groq triggered:', err.message);
    return getGroqResponse(messages, persona);
  }
};

const getGroqResponse = async (messages, persona) => {
  const GROQ_API_KEY = getGroqKey();
  try {
    if (!GROQ_API_KEY || GROQ_API_KEY.startsWith('YOUR_')) {
      return `${persona} seems to be thinking hard, please give her a moment.`;
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const body = {
      model: 'llama-3.1-8b-instant', 
      messages: messages,
      temperature: 0.7,
      max_tokens: 800
    };

    logRequest('Groq', url, body);

    const data = await fetchWithRetry(() => fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }), 'Groq');

    return data.choices[0]?.message?.content || `${persona} seems to be thinking hard, please give her a moment.`;
  } catch (err) {
    recordError();
    console.error('AI Brain Error:', err);
    return `${persona} seems to be thinking hard, please give her a moment.`;
  }
};
