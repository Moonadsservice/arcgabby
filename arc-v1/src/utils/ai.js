const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const getAIResponse = async (messages) => {
  // Try Gemini first
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {
      throw new Error('Gemini API Key missing');
    }

    console.log('Requesting AI response from Gemini...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || "I couldn't generate a response.";
    }
    throw new Error(`Gemini API Error: ${response.status}`);
  } catch (err) {
    console.warn('Gemini failed, falling back to Groq:', err.message);
    return getGroqResponse(messages);
  }
};

const getGroqResponse = async (messages) => {
  try {
    if (!GROQ_API_KEY || GROQ_API_KEY.startsWith('YOUR_')) {
      return "Please configure AI API Keys for responses.";
    }

    console.log('Requesting AI response from Groq...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || "I couldn't generate a response.";
    }
    throw new Error(`Groq API Error: ${response.status}`);
  } catch (err) {
    console.error('Groq Exception:', err);
    return "I'm experiencing a temporary connection issue. Please try again in a moment.";
  }
};
