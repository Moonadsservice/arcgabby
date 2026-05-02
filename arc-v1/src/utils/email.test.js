import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, sendFlightNotification } from './email';
import { supabase } from './supabase';

global.fetch = vi.fn();

vi.mock('./supabase', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };
  return { supabase: mockSupabase };
});

describe('Email Service', () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_RESEND_API_KEY', 're_test_key');
    
    mockSupabase = supabase;
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
  });

  describe('sendEmail', () => {
    it('should retry on rate limit (429) and eventually succeed', async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({ message: 'Rate limit' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: 'msg_123' }) });

      const result = await sendEmail({ 
        to: 'test@example.com', 
        subject: 'Test', 
        html: '<p>Hi</p>', 
        userId: 'user_123' 
      });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('email_send_logs');
    });

    it('should fail after max retries', async () => {
      fetch.mockResolvedValue({ 
        ok: false, 
        status: 500, 
        json: () => Promise.resolve({ message: 'Server error' }) 
      });

      const result = await sendEmail({ 
        to: 'test@example.com', 
        subject: 'Test', 
        html: '<p>Hi</p>', 
        userId: 'user_123' 
      });

      expect(fetch).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
      expect(result.success).toBe(false);
    });
  });

  describe('sendFlightNotification', () => {
    it('should resolve names to emails and send', async () => {
      const mockContacts = [
        { email: 'contact1@example.com', display_name: 'Contact 1' }
      ];
      
      mockSupabase.in.mockResolvedValueOnce({ data: mockContacts, error: null });
      fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: 'msg_1' }) });

      const result = await sendFlightNotification({
        userId: 'user_1',
        flightNumber: 'AA123',
        contactNames: ['Contact 1'],
        eventType: 'Arrived'
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.in).toHaveBeenCalledWith('display_name', ['Contact 1']);
      expect(fetch).toHaveBeenCalled();
    });
  });
});
