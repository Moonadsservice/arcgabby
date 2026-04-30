const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemini-pro-1.5:free',
  'mistralai/pixtral-12b:free',
  'qwen/qwen-2-7b-instruct:free',
  'openchat/openchat-7b:free'
];

export const getOpenRouterResponse = async (messages, modelIndex = 0) => {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.startsWith('YOUR_')) {
    console.error('OpenRouter API Key is missing or invalid');
    return "Please configure VITE_OPENROUTER_API_KEY for AI responses.";
  }

  console.log(`Requesting AI response using model: ${FREE_MODELS[modelIndex]}`);

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
      const errorData = await response.json().catch(() => ({}));
      console.error(`OpenRouter API Error (${response.status}):`, errorData);
      
      if (modelIndex < FREE_MODELS.length - 1) {
        console.warn(`Model ${FREE_MODELS[modelIndex]} failed, falling back to ${FREE_MODELS[modelIndex + 1]}`);
        return getOpenRouterResponse(messages, modelIndex + 1);
      }
      throw new Error('All OpenRouter models failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('OpenRouter returned empty content:', data);
      throw new Error('Empty response from AI');
    }

    return content;
  } catch (err) {
    console.error('OpenRouter Exception:', err);
    if (modelIndex < FREE_MODELS.length - 1) {
      console.log('Attempting fallback model...');
      return getOpenRouterResponse(messages, modelIndex + 1);
    }
    return "I'm experiencing a temporary connection issue. Please try again in a moment.";
  }
};
