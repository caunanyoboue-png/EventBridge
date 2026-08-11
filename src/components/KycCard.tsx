import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, Upload, XCircle, Check, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Carte de certification (KYC) — facultative : fournir sa pièce donne le badge
// « Certifié » (plus de confiance / visibilité), sans bloquer l'accès aux missions.
export default function KycCard({ alwaysShow = false, offersLink = true }: { alwaysShow?: boolean; offersLink?: boolean }) {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const rectoRef  = useRef<HTMLInputElement>(null);
  const versoRef  = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const [recto, setRecto]   = useState<File | null>(null);
  const [verso, setVerso]   = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile || (profile.role !== 'freelance' && profile.role !== 'organisateur')) return null;
  const isOrga = profile.role === 'organisateur';
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

  // Identité déjà validée (sans certification payante) → état de confirmation.
  const docsComplets = !!profile.kyc_document_path && !!profile.kyc_document_back_path && !!profile.kyc_selfie_path;
  if (status === 'verified' && docsComplets) {
    if (!alwaysShow && !isOrga) return null;
    return (
      <div style={{
        background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.35)', borderRadius: 14,
        padding: '16px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,200,150,0.20)' }}>
          <BadgeCheck size={22} color="#00C896" />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Identité vérifiée ✓</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {isOrga
              ? 'Vous pouvez publier vos missions et lancer un S.O.S Brigade.'
              : 'Vous pouvez maintenant choisir votre formule de certification.'}
          </div>
          {!isOrga && offersLink && (
            <button onClick={() => navigate('/certification')}
              style={{ marginTop: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-gold-primary)', fontSize: 12, fontWeight: 700 }}>
              Voir les offres de certification →
            </button>
          )}
        </div>
      </div>
    );
  }

  async function uploadOne(file: File, side: 'recto' | 'verso' | 'selfie'): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profile!.id}/cni_${side}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('kyc').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  }

  async function submit() {
    if (!recto || !verso || !selfie || !profile) {
      toast.error('Ajoutez le recto, le verso et votre selfie avec la pièce.'); return;
    }
    const tooBig = [recto, verso, selfie].some(f => f.size > 8 * 1024 * 1024);
    if (tooBig) { toast.error('Chaque image doit faire moins de 8 Mo.'); return; }
    setBusy(true);
    try {
      const rectoPath  = await uploadOne(recto, 'recto');
      const versoPath  = await uploadOne(verso, 'verso');
      const selfiePath = await uploadOne(selfie, 'selfie');
      await updateProfile({
        kyc_document_path: rectoPath, kyc_document_back_path: versoPath,
        kyc_selfie_path: selfiePath,
        kyc_status: 'pending', kyc_submitted_at: new Date().toISOString(),
      });
      toast.success('Dossier envoyé — en attente de vérification.');
      setRecto(null); setVerso(null); setSelfie(null);
    } catch (e) {
      const msg = (e as { message?: string })?.message || 'Échec de l\'envoi';
      console.error('[KYC upload]', e);
      toast.error(`Échec : ${msg}`);
    } finally {
      setBusy(false);
      if (rectoRef.current)  rectoRef.current.value = '';
      if (versoRef.current)  versoRef.current.value = '';
      if (selfieRef.current) selfieRef.current.value = '';
    }
  }

  const complet = !!recto && !!verso && !!selfie;

  const theme: { bg: string; bd: string; col: string; Icon: LucideIcon; title: string; msg: string } =
    status === 'pending'
      ? { bg: 'rgba(59,130,246,0.1)', bd: 'rgba(59,130,246,0.3)', col: '#3b82f6', Icon: Clock,
          title: 'Vérification en cours',
          msg: `Votre dossier (recto, verso et selfie) a bien été envoyé. Un administrateur le vérifie sous 24 à 48 h.${isOrga ? ' Vous pourrez publier vos missions dès la validation.' : ''}` }
      : status === 'rejected'
      ? { bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.3)', col: '#ef4444', Icon: XCircle,
          title: 'Dossier refusé', msg: profile.kyc_rejection_reason || 'Vos pièces ont été refusées. Merci d\'en renvoyer de nouvelles, bien lisibles : recto, verso et un selfie où l\'on vous voit tenir votre pièce.' }
      : isOrga
      ? { bg: 'rgba(239,68,68,0.08)', bd: 'rgba(239,68,68,0.30)', col: '#ef4444', Icon: ShieldAlert,
          title: 'Vérification obligatoire pour publier',
          msg: 'Avant de publier une mission ou de lancer un S.O.S Brigade, vous devez faire vérifier votre identité. Envoyez 3 documents : le recto et le verso de votre pièce (CNI ou passeport), plus un selfie où l\'on vous voit tenir cette pièce. Contrôle sous 24 à 48 h.' }
      : { bg: 'rgba(212,175,55,0.1)', bd: 'rgba(212,175,55,0.3)', col: 'var(--color-gold-primary)', Icon: BadgeCheck,
          title: 'Faites vérifier votre identité', msg: 'Envoyez 3 documents : le recto et le verso de votre pièce (CNI ou passeport), plus un selfie où l\'on vous voit tenir cette pièce — visage et document bien lisibles.' };

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
        {offersLink && canUpload && !isOrga && (
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
          {/* capture="user" ouvre directement la caméra frontale sur mobile */}
          <input ref={selfieRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }}
            onChange={e => setSelfie(e.target.files?.[0] ?? null)} />
          {pick(recto, 'Recto', rectoRef)}
          {pick(verso, 'Verso', versoRef)}
          {pick(selfie, 'Selfie avec la pièce', selfieRef)}
          <button type="button" onClick={submit} disabled={busy || !complet}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
              background: 'var(--color-gold-primary)', color: '#261642', fontSize: 13, fontWeight: 700,
              border: 'none', cursor: busy || !complet ? 'not-allowed' : 'pointer', opacity: busy || !complet ? 0.55 : 1,
            }}>
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      )}
    </div>
  );
}
