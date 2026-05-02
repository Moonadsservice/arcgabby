import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Utility to validate URL
const isValidUrl = (url) => {
  try {
    return url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('YOUR_SUPABASE_URL');
  } catch (e) {
    return false;
  }
};

// Initialize Supabase client only if a valid URL is provided
export const supabase = isValidUrl(SUPABASE_URL) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
