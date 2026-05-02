import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_GEMINI_API_KEY: 'test_gemini_key',
    VITE_GROQ_API_KEY: 'test_groq_key',
    VITE_RESEND_API_KEY: 're_test_key',
  },
});
