import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Utility to validate URL
const isValidUrl = (url) => {
  try {
    return url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('YOUR_SUPABASE_URL');
  } catch (e) {
    return false;
  }
};

// Initialize Supabase client only if a valid URL is provided
const supabase = isValidUrl(SUPABASE_URL) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * Saves AI outputs into Supabase 'files' table.
 * @param {Object} data - Memory data
 * @param {string} data.title - Title of the memory
 * @param {string} data.content - Main content
 * @param {string} data.type - Type (e.g., youtube_summary, web_search, note)
 * @param {string[]} data.tags - Array of tags
 * @param {Object} data.metadata - Additional metadata
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export const saveMemory = async ({ title, content, type, tags, metadata }) => {
  if (!supabase) {
    console.warn('Supabase not configured. Skipping memory save.');
    return { success: false, error: 'Supabase URL not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('files')
      .insert([
        { title, content, type, tags, metadata }
      ])
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
 * @param {string} query - User search query
 * @returns {Promise<{success: boolean, data?: any[], error?: any}>}
 */
export const searchMemory = async (query) => {
  if (!supabase) {
    console.warn('Supabase not configured. Skipping memory search.');
    return { success: false, error: 'Supabase URL not configured' };
  }
  try {
    // We'll search in title, content, and tags
    // For tags, we'll check if any tag in the array matches the query
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

export default supabase;
