-- SQL Migration: Emergency Contacts & Flight Messaging Preferences
-- Description: Supports storing emergency contacts, their relationship to users, 
-- and flight-specific messaging preferences with audit columns and soft-delete flags.

-- 1. Create Emergency Contacts Table
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user_id and email
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_email ON emergency_contacts(email);

-- 2. Create Flight Messaging Preferences Table
CREATE TABLE IF NOT EXISTS flight_messaging_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flight_number TEXT NOT NULL,
    contact_id UUID NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, flight_number, contact_id)
);

-- Index for lookup by flight_number
CREATE INDEX IF NOT EXISTS idx_flight_messaging_prefs_flight_number ON flight_messaging_preferences(flight_number);
CREATE INDEX IF NOT EXISTS idx_flight_messaging_prefs_user_id ON flight_messaging_preferences(user_id);

-- 3. Create Email Send Logs Table
CREATE TABLE IF NOT EXISTS email_send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed', 'retrying'
    error_message TEXT,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tracking logs by recipient and status
CREATE INDEX IF NOT EXISTS idx_email_send_logs_recipient ON email_send_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON email_send_logs(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_messaging_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies
-- Users can only see and manage their own emergency contacts
CREATE POLICY "Users can manage their own emergency contacts"
ON emergency_contacts
FOR ALL
USING (auth.uid() = user_id);

-- Users can only see and manage their own flight preferences
CREATE POLICY "Users can manage their own flight preferences"
ON flight_messaging_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Users can only see their own email logs
CREATE POLICY "Users can view their own email logs"
ON email_send_logs
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Add trigger for updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_emergency_contacts_updated_at
    BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_messaging_prefs_updated_at
    BEFORE UPDATE ON flight_messaging_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_send_logs_updated_at
    BEFORE UPDATE ON email_send_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
