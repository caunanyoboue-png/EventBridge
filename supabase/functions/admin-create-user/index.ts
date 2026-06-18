// Edge Function : création d'un compte administrateur.
// Réservé à l'admin PRINCIPAL (is_super_admin). La création d'utilisateur exige
// la clé service_role, qui ne doit jamais être exposée au navigateur → on la fait ici.
//
// Deploy : supabase functions deploy admin-create-user

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SRV_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

    const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Non authentifié' }, 401);

    // Identifier l'appelant
    const { data: { user }, error: authErr } =
      await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Token invalide' }, 401);

    const admin = createClient(SUPABASE_URL, SRV_KEY);

    // Vérifier qu'il est bien l'admin principal
    const { data: me } = await admin.from('profiles')
      .select('role, is_super_admin').eq('id', user.id).single();
    if (!me || me.role !== 'admin' || !me.is_super_admin) {
      return json({ error: 'Action réservée à l\'admin principal' }, 403);
    }

    const { email, password, full_name } = await req.json();
    if (!email || !password || String(password).length < 8) {
      return json({ error: 'Email et mot de passe (8 caractères min.) requis' }, 400);
    }

    // Créer le compte (email déjà confirmé → connexion immédiate possible)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email, role: 'admin' },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // S'assurer que le profil est bien un admin actif (jamais super-admin par défaut)
    await admin.from('profiles').update({
      role: 'admin', full_name: full_name || email, status: 'active', is_super_admin: false,
    }).eq('id', created.user!.id);

    return json({ ok: true, id: created.user!.id });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
