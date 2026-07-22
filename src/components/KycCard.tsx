import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, Upload, XCircle, Check, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Carte de certification (KYC) — facultative : fournir sa pièce donne le badge
// « Certifié » (plus de confiance / visibilité), sans bloquer l'accès aux missions.
export default function KycCard({ alwaysShow = false, offersLink = true }: { alwaysShow?: boolean; offersLink?: boolean }) {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const rectoRef = useRef<HTMLInputElement>(null);
  const versoRef = useRef<HTMLInputElement>(null);
  const [recto, setRecto] = useState<File | null>(null);
  const [verso, setVerso] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile || profile.role !== 'freelance') return null;
  const status = profile.kyc_status || 'unverified';
  const level = profile.certification_level || 'none';

  // VRAIE certification = certification_level (gris/bleu), PAS kyc_status.
  // (Le grandfather a posé kyc_status='verified' sans certifier → ne pas afficher "certifié".)
  if (level !== 'none') {
    if (!alwaysShow) return null;
    const blue = level === 'blue';
    const col = blue ? '#3b82f6' : '#9ca3af';
    return (
      <div style={{
        background: `${col}1a`, border: `1px solid ${col}55`, borderRadius: 14,
        padding: '16px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${col}30` }}>
          <BadgeCheck size={22} color={col} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Profil certifié{blue ? ' — Pro (bleu)' : ' (gris)'} ✓</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>Votre badge Certifié est visible par les organisateurs.</div>
        </div>
      </div>
    );
  }

  async function uploadOne(file: File, side: 'recto' | 'verso'): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profile!.id}/cni_${side}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('kyc').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  }

  async function submit() {
    if (!recto || !verso || !profile) { toast.error('Ajoutez le recto ET le verso de votre pièce.'); return; }
    if (recto.size > 8 * 1024 * 1024 || verso.size > 8 * 1024 * 1024) { toast.error('Chaque image doit faire moins de 8 Mo.'); return; }
    setBusy(true);
    try {
      const rectoPath = await uploadOne(recto, 'recto');
      const versoPath = await uploadOne(verso, 'verso');
      await updateProfile({
        kyc_document_path: rectoPath, kyc_document_back_path: versoPath,
        kyc_status: 'pending', kyc_submitted_at: new Date().toISOString(),
      });
      toast.success('Pièce envoyée — en attente de vérification.');
      setRecto(null); setVerso(null);
    } catch (e) {
      const msg = (e as { message?: string })?.message || 'Échec de l\'envoi';
      console.error('[KYC upload]', e);
      toast.error(`Échec : ${msg}`);
    } finally {
      setBusy(false);
      if (rectoRef.current) rectoRef.current.value = '';
      if (versoRef.current) versoRef.current.value = '';
    }
  }

  const theme: { bg: string; bd: string; col: string; Icon: LucideIcon; title: string; msg: string } =
    status === 'pending'
      ? { bg: 'rgba(59,130,246,0.1)', bd: 'rgba(59,130,246,0.3)', col: '#3b82f6', Icon: Clock,
          title: 'Certification en cours', msg: 'Vos pièces (recto + verso) ont bien été envoyées. Un administrateur les vérifie sous peu.' }
      : status === 'rejected'
      ? { bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.3)', col: '#ef4444', Icon: XCircle,
          title: 'Pièce refusée', msg: profile.kyc_rejection_reason || 'Vos pièces ont été refusées. Merci d\'en renvoyer de nouvelles (recto + verso, bien lisibles).' }
      : { bg: 'rgba(212,175,55,0.1)', bd: 'rgba(212,175,55,0.3)', col: 'var(--color-gold-primary)', Icon: BadgeCheck,
          title: 'Obtenez votre badge Certifié', msg: 'Facultatif, mais ça rassure les organisateurs et booste votre visibilité. Envoyez le recto ET le verso de votre pièce (CNI ou passeport).' };

  // Peut envoyer ses pièces tant qu'il n'est pas certifié et qu'aucune revue n'est en cours.
  const canUpload = status !== 'pending';

  const pick = (file: File | null, label: string, ref: { current: HTMLInputElement | null }) => (
    <button type="button" onClick={() => ref.current?.click()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer',
        background: file ? 'rgba(0,200,150,0.14)' : 'var(--color-input-bg)',
        border: `1px solid ${file ? 'rgba(0,200,150,0.4)' : 'rgba(201,168,76,0.25)'}`,
        color: file ? '#00C896' : 'var(--color-text-primary)',
      }}>
      {file ? <Check size={14} /> : <Upload size={14} />} {label}{file ? ' ✓' : ''}
    </button>
  );

  return (
    <div style={{
      background: theme.bg, border: `1px solid ${theme.bd}`, borderRadius: 14,
      padding: '16px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.col}22` }}>
        <theme.Icon size={22} color={theme.col} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{theme.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>{theme.msg}</div>
        {offersLink && canUpload && (
          <button onClick={() => navigate('/certification')}
            style={{ marginTop: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-gold-primary)', fontSize: 12, fontWeight: 700 }}>
            Voir les offres de certification →
          </button>
        )}
      </div>
      {canUpload && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input ref={rectoRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={e => setRecto(e.target.files?.[0] ?? null)} />
          <input ref={versoRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={e => setVerso(e.target.files?.[0] ?? null)} />
          {pick(recto, 'Recto', rectoRef)}
          {pick(verso, 'Verso', versoRef)}
          <button type="button" onClick={submit} disabled={busy || !recto || !verso}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
              background: 'var(--color-gold-primary)', color: '#261642', fontSize: 13, fontWeight: 700,
              border: 'none', cursor: busy || !recto || !verso ? 'not-allowed' : 'pointer', opacity: busy || !recto || !verso ? 0.55 : 1,
            }}>
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      )}
    </div>
  );
}
