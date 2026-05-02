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

/**
 * Saves AI outputs into Supabase 'files' table.
 */
export const saveMemory = async ({ title, content, type, tags, metadata }) => {
  if (!supabase) return { success: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase
      .from('files')
      .insert([{ title, content, type, tags, metadata }])
      .select();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving memory:', error);
    return { success: false, error };
  }
};

/**
 * Searches 'files' table using ILIKE and tag matches.
 */
export const searchMemory = async (query) => {
  if (!supabase) return { success: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching memory:', error);
    return { success: false, error };
  }
};

export const saveUserEmail = async (email) => {
  if (!supabase) return { success: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ email, updated_at: new Date() }, { onConflict: 'email' });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving email:', error);
    return { success: false, error };
  }
};
