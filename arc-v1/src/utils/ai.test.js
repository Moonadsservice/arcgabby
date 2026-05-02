import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAIResponse } from './ai';

global.fetch = vi.fn();

describe('AI Response Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test_gemini_key');
    vi.stubEnv('VITE_GROQ_API_KEY', 'test_groq_key');
  });

  it('should retry on Gemini 500 error and then fallback to Groq if retries fail', async () => {
    // Mock Gemini failing 3 times with 500
    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') });
    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') });
    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') });
    
    // Then mock Groq succeeding
    fetch.mockResolvedValueOnce({ 
      ok: true, 
      status: 200, 
      json: () => Promise.resolve({ choices: [{ message: { content: 'Groq response' } }] }) 
    });

    const response = await getAIResponse([{ role: 'user', content: 'hello' }], 'Jenny');
    
    expect(fetch).toHaveBeenCalledTimes(4); // 3 Gemini retries + 1 Groq
    expect(response).toBe('Groq response');
  });

  it('should return persona-consistent error message if both backends fail', async () => {
    // Mock all failing
    fetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Error') });

    const response = await getAIResponse([{ role: 'user', content: 'hello' }], 'Gabby');
    
    expect(response).toBe('Gabby seems to be thinking hard, please give her a moment.');
  });
});
