const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-7b-it:free',
  'meta-llama/llama-3-8b-instruct:free'
];

export const getOpenRouterResponse = async (messages, modelIndex = 0) => {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.startsWith('YOUR_')) {
    return "Please configure VITE_OPENROUTER_API_KEY for AI responses.";
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'ARC Assistant',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: FREE_MODELS[modelIndex],
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      if (modelIndex < FREE_MODELS.length - 1) {
        console.warn(`Model ${FREE_MODELS[modelIndex]} failed, falling back to ${FREE_MODELS[modelIndex + 1]}`);
        return getOpenRouterResponse(messages, modelIndex + 1);
      }
      throw new Error('All OpenRouter models failed');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (err) {
    console.error('OpenRouter Error:', err);
    if (modelIndex < FREE_MODELS.length - 1) {
      return getOpenRouterResponse(messages, modelIndex + 1);
    }
    return "I'm experiencing a temporary connection issue. Please try again in a moment.";
  }
};
