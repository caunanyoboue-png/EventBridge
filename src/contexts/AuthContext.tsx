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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: data.full_name || '',
          role: data.role || 'freelance',
          ville: data.ville || 'Abidjan - Cocody',
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
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',   // NOT NULL dans la table → toujours inclus
      ...data,
    });
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
