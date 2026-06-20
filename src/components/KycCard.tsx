import { useRef, useState } from 'react';
import { ShieldAlert, Clock, Upload, XCircle, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Carte de vérification d'identité (KYC) — visible pour le freelance.
// Sert à la fois de rappel (RG3/RG11) et de point d'upload de la pièce.
export default function KycCard() {
  const { profile, updateProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!profile || profile.role !== 'freelance') return null;
  const status = profile.kyc_status || 'unverified';
  if (status === 'verified') return null; // rien à afficher si déjà vérifié

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Fichier trop lourd (max 8 Mo).'); return; }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${profile.id}/cni_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('kyc').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await updateProfile({ kyc_document_path: path, kyc_status: 'pending', kyc_submitted_at: new Date().toISOString() });
      toast.success('Pièce envoyée — en attente de vérification.');
    } catch {
      toast.error('Échec de l\'envoi. Réessayez.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const theme: { bg: string; bd: string; col: string; Icon: LucideIcon; title: string; msg: string } =
    status === 'pending'
      ? { bg: 'rgba(59,130,246,0.1)', bd: 'rgba(59,130,246,0.3)', col: '#3b82f6', Icon: Clock,
          title: 'Vérification en cours', msg: 'Votre pièce a bien été envoyée. Un administrateur la vérifie sous peu.' }
      : status === 'rejected'
      ? { bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.3)', col: '#ef4444', Icon: XCircle,
          title: 'Pièce refusée', msg: profile.kyc_rejection_reason || 'Votre pièce a été refusée. Merci d\'en envoyer une nouvelle.' }
      : { bg: 'rgba(245,158,11,0.1)', bd: 'rgba(245,158,11,0.3)', col: '#F59E0B', Icon: ShieldAlert,
          title: 'Vérifiez votre identité', msg: 'Pour recevoir des missions et apparaître auprès des organisateurs, envoyez une pièce d\'identité (CNI ou passeport).' };

  const canUpload = status === 'unverified' || status === 'rejected';

  return (
    <div style={{
      background: theme.bg, border: `1px solid ${theme.bd}`, borderRadius: 14,
      padding: '16px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.col}22` }}>
        <theme.Icon size={22} color={theme.col} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3' }}>{theme.title}</div>
        <div style={{ fontSize: 12.5, color: '#b8a898', marginTop: 2 }}>{theme.msg}</div>
      </div>
      {canUpload && (
        <>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642', fontSize: 13, fontWeight: 700,
              border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
            }}>
            <Upload size={15} /> {busy ? 'Envoi…' : status === 'rejected' ? 'Renvoyer ma pièce' : 'Envoyer ma pièce'}
          </button>
        </>
      )}
    </div>
  );
}
