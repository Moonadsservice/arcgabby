import { YoutubeTranscript as YouTubeTranscript } from 'youtube-transcript';

/**
 * Extracts video ID from a YouTube URL.
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null if not found
 */
export const extractVideoId = (url) => {
  const regex = /(?:v=|youtu\.be\/|embed\/|v\/|shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

/**
 * Fetches transcript and splits it into chunks of approximately 5-10 minutes.
 * @param {string} videoId - YouTube Video ID
 * @param {number} chunkDuration - Duration of each chunk in seconds (default 300s / 5m)
 * @returns {Promise<Array<{text: string, start: number, end: number}>>}
 */
export const fetchTranscriptChunks = async (videoId, chunkDuration = 300) => {
  try {
    const transcript = await YouTubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript found for this video.');
    }

    const chunks = [];
    let currentChunk = { text: '', start: transcript[0].offset, end: 0 };
    let currentChunkStartTime = transcript[0].offset;

    transcript.forEach((item) => {
      // Check if current item exceeds the chunk duration
      if (item.offset - currentChunkStartTime > chunkDuration * 1000) {
        currentChunk.end = item.offset;
        chunks.push(currentChunk);
        
        // Start new chunk
        currentChunk = { text: item.text, start: item.offset, end: 0 };
        currentChunkStartTime = item.offset;
      } else {
        currentChunk.text += ' ' + item.text;
      }
    });

    // Add the last chunk
    const lastItem = transcript[transcript.length - 1];
    currentChunk.end = lastItem.offset + lastItem.duration;
    chunks.push(currentChunk);

    return chunks;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
};

/**
 * Formats seconds into a timestamp string (MM:SS).
 * @param {number} ms - Time in milliseconds
 * @returns {string}
 */
export const formatTimestamp = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
