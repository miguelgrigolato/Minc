// Ponto de entrada da Edge Function "admin-users" (Supabase). verify_jwt = true.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente pelo Supabase aos segredos da função.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, SITE_URL } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve((req) => handle(req, { admin, siteUrl: Deno.env.get('SITE_URL') || SITE_URL }));
