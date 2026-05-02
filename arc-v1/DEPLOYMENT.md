# Deployment Checklist & Runbook

## Deployment Artefacts
- **SQL Migration**: `supabase/migrations/20260430000000_emergency_contacts.sql`
- **Frontend Code**: `App.jsx`, `src/utils/email.js`, `src/hooks/useDeepgramAudio.js`
- **Configuration**: Updated `.env` with `VITE_RESEND_API_KEY` and `VITE_ONESIGNAL_APP_ID`.

## Pre-Deployment Checklist
1. [ ] Verify all tests pass: `npm test`.
2. [ ] Ensure `VITE_RESEND_API_KEY` is provisioned in the CI/CD pipeline.
3. [ ] Validate Supabase connection and permissions for the service role.
4. [ ] Check OneSignal dashboard for correct `appId` and active segments.

## Deployment Steps (Zero-Downtime)
1. **Database Migration**:
   - Run the SQL migration file against the production Supabase instance.
   - Tables are created with `IF NOT EXISTS` to prevent errors.
   - RLS policies ensure data privacy during the transition.
2. **Environment Update**:
   - Update production environment variables with the new API keys.
3. **Frontend Release**:
   - Deploy the updated frontend build.
   - The OneSignal SDK will load asynchronously and initialize without blocking the main thread.
4. **Post-Deployment Verification**:
   - Verify OneSignal registration in the browser console.
   - Send a test email via the internal monitoring tool.
   - Check `email_send_logs` in Supabase for successful entries.

## Rollback Plan
1. **Frontend**:
   - Revert to the previous stable build hash in the deployment platform (e.g., Vercel, Netlify).
2. **Database**:
   - If critical issues arise, rename the new tables (e.g., `emergency_contacts_failed_v1`) to preserve data while restoring old functionality.
   - Note: Soft-delete and audit columns are backward-compatible and typically do not require rollback.
3. **Configuration**:
   - Revert environment variables if API keys are compromised or failing.
