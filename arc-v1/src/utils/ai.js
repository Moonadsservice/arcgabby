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
    
    // Define tools for Gemini
    const tools = [
      {
        function_declarations: [
          {
            name: "send_email",
            description: "Send an email to a recipient with a subject and HTML content.",
            parameters: {
              type: "OBJECT",
              properties: {
                to: { type: "STRING", description: "The recipient email address." },
                subject: { type: "STRING", description: "The subject of the email." },
                html: { type: "STRING", description: "The HTML content of the email." }
              },
              required: ["to", "subject", "html"]
            }
          },
          {
            name: "fetch_weather",
            description: "Get the current weather for a specific location.",
            parameters: {
              type: "OBJECT",
              properties: {
                location: { type: "STRING", description: "The city and country, e.g., London, UK" }
              },
              required: ["location"]
            }
          },
          {
            name: "fetch_flight_status",
            description: "Get the current status of a flight by its flight number.",
            parameters: {
              type: "OBJECT",
              properties: {
                flight_number: { type: "STRING", description: "The flight number, e.g., BA123" }
              },
              required: ["flight_number"]
            }
          },
          {
            name: "book_ride",
            description: "Initiate a ride booking (Uber or Bolt) to a destination.",
            parameters: {
              type: "OBJECT",
              properties: {
                destination: { type: "STRING", description: "The destination address or place name." },
                provider: { type: "STRING", enum: ["uber", "bolt"], description: "The ride service provider." }
              },
              required: ["destination", "provider"]
            }
          }
        ]
      }
    ];

    const body = {
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      tools: tools,
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

    const candidate = data.candidates[0];
    const content = candidate?.content?.parts[0]?.text;
    const call = candidate?.content?.parts.find(p => p.functionCall);

    if (call) {
      return {
        type: 'tool_call',
        name: call.functionCall.name,
        args: call.functionCall.args,
        text: content || `Executing ${call.functionCall.name}...`
      };
    }

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
