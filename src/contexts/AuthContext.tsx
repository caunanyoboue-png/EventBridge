import { createContext, useContext, useEffect, useState } from 'react';
import { type ReactNode } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { type Profile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, data: Partial<Profile>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (data) {
      setProfile(data);
      setLoading(false);
      return;
    }

    // Aucune ligne trouvée — le trigger handle_new_user() n'a pas fonctionné.
    // On crée le profil depuis les métadonnées auth.
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const meta = authUser.user_metadata || {};
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: meta.full_name || '',
        email: authUser.email || '',
        role: (meta.role as Profile['role']) || 'freelance',
        ville: meta.ville || 'Abidjan - Cocody',
        status: 'active' as const,
        onboarding_done: false,
      });
      const { data: created } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setProfile(created);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }

  async function signUp(email: string, password: string, data: Partial<Profile>) {
    // Le profil complet est transporté dans les métadonnées : le trigger
    // handle_new_user() les recopie dans `profiles` à la création du compte.
    // Le lien du mail est donc la DERNIÈRE étape → il mène droit au fil d'actualité.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/feed?welcome=1`,
        data: {
          full_name: data.full_name || '',
          role: data.role || 'freelance',
          ville: data.ville || 'Abidjan - Cocody',
          phone: data.phone ?? null,
          quartier: data.quartier ?? null,
          bio: data.bio ?? null,
          skills: data.skills ?? null,
          hourly_rate: data.hourly_rate ?? null,
          prestation_rates: data.prestation_rates ?? null,
          experience_years: data.experience_years ?? null,
          company_name: data.company_name ?? null,
          company_sector: data.company_sector ?? null,
        },
      },
    });
    if (error) throw error;
    // Le profil est créé automatiquement par le trigger handle_new_user()
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function updateProfile(data: Partial<Profile>) {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
