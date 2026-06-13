import { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const C = {
  card:    '#1a1232',
  gold:    '#d4af37',
  goldLt:  '#e8c97a',
  text:    '#f0e6d3',
  textDim: 'rgba(240,230,211,0.45)',
  border:  'rgba(201,168,76,0.12)',
} as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(201,168,76,0.18)',
  color: C.text,
};

const sLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.8px', color: 'rgba(201,168,76,0.5)',
  marginBottom: 14,
};

export default function Settings() {
  const { user, signOut } = useAuth();

  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [busy, setBusy]             = useState(false);

  async function handleChangePassword() {
    if (!newPwd || newPwd.length < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères.'); return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Les mots de passe ne correspondent pas.'); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success('Mot de passe mis à jour.');
      setNewPwd(''); setConfirmPwd('');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur lors du changement de mot de passe.');
    } finally { setBusy(false); }
  }

  async function handleDeleteAccount() {
    const confirm = window.confirm(
      'Supprimer votre compte est irréversible. Toutes vos données seront perdues. Continuer ?'
    );
    if (!confirm) return;
    toast.error('Pour supprimer votre compte, contactez le support EventBridge.');
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: C.text, marginBottom: 24 }}>Paramètres</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>

        {/* Compte */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <p style={sLabel}>Informations du compte</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Adresse email</p>
              <input style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} value={user?.email || ''} disabled />
            </div>
          </div>
        </div>

        {/* Mot de passe */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <p style={sLabel}>Changer le mot de passe</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={inp} type="password" placeholder="Nouveau mot de passe (min. 6 caractères)"
              value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <input style={inp} type="password" placeholder="Confirmer le nouveau mot de passe"
              value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            <button
              onClick={handleChangePassword}
              disabled={busy || !newPwd || !confirmPwd}
              style={{
                padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: 'none', cursor: (busy || !newPwd || !confirmPwd) ? 'not-allowed' : 'pointer',
                background: `linear-gradient(135deg,${C.gold},${C.goldLt})`,
                color: '#261642',
                opacity: (busy || !newPwd || !confirmPwd) ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}>
              {busy ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </div>

        {/* Déconnexion */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <p style={sLabel}>Session</p>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', background: 'transparent',
              border: '1px solid rgba(201,168,76,0.2)', color: C.textDim,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = C.textDim; }}>
            Se déconnecter
          </button>
        </div>

        {/* Zone dangereuse */}
        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16, padding: '22px 24px' }}>
          <p style={{ ...sLabel, color: 'rgba(239,68,68,0.5)' }}>Zone dangereuse</p>
          <p style={{ fontSize: 13, color: C.textDim, marginBottom: 14 }}>
            La suppression de votre compte est définitive et irréversible.
          </p>
          <button
            onClick={handleDeleteAccount}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            Supprimer mon compte
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}
