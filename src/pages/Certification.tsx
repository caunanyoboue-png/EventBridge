import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, BadgeCheck, Crown, Star, Wallet as WalletIcon, ShieldCheck, Clock, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/layout/DashboardLayout';
import KycCard from '../components/KycCard';
import { useAuth } from '../contexts/AuthContext';
import { formatCFA } from '../lib/utils';
import { getWallet, payCertification, getCertificationPrice, cancelCertification } from '../lib/walletService';
import { type CertificationLevel } from '../types';

interface Plan {
  key: CertificationLevel;
  name: string;
  monthly: number;
  yearly: number;
  color: string;
  Icon: typeof Star;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'none', name: 'Gratuit', monthly: 0, yearly: 0, color: '#9aa0ac', Icon: Star,
    features: ['Profil actif et visible', 'Candidatures limitées', 'Apparaît dans les recherches', 'Accès au S.O.S Brigade'],
  },
  {
    key: 'grey', name: 'Certifié — Gris', monthly: 1500, yearly: 15000, color: '#9ca3af', Icon: BadgeCheck,
    features: ['Badge Certifié (gris) après ton nom', 'Identité vérifiée', 'Remontée dans les recherches', 'Candidatures illimitées', 'Priorité sur le S.O.S Brigade', 'Portfolio étendu'],
  },
  {
    key: 'blue', name: 'Certifié — Bleu', monthly: 4000, yearly: 40000, color: '#3b82f6', Icon: Crown, popular: true,
    features: ['Tout le niveau Gris', 'Visibilité maximale (tout en haut)', 'Section « Top freelances »', 'Réduction sur ta certification (renouvellement)', 'Portfolio complet mis en avant', 'Support prioritaire', 'Badge bleu « Pro »'],
  },
];

export default function Certification() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [balance, setBalance] = useState(0);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const [confirmLevel, setConfirmLevel] = useState<'grey' | 'blue' | null>(null);
  const [kycGate, setKycGate] = useState(false);   // formulaire bloquant « pièces obligatoires »
  const [cancelling, setCancelling] = useState(false);
  const current = (profile?.certification_level || 'none') as CertificationLevel;
  const period = annual ? 'year' : 'month';

  const expiresAt = profile?.certification_expires_at
    ? new Date(profile.certification_expires_at) : null;
  const isActive = !!expiresAt && expiresAt > new Date();
  const kycStatus = profile?.kyc_status || 'unverified';
  // Les pièces doivent exister RÉELLEMENT : d'anciens profils ont hérité d'un
  // kyc_status « verified » sans avoir jamais déposé de document.
  const hasDocs = !!profile?.kyc_document_path && !!profile?.kyc_document_back_path;
  const kycVerified = kycStatus === 'verified' && hasDocs;
  const kycPending  = kycStatus === 'pending' && hasDocs;
  const kycRejected = kycStatus === 'rejected';
  // Toute la procédure de paiement reste bloquée tant que l'identité n'est pas VÉRIFIÉE.
  const canPay = kycVerified;

  const goUpload = () => document.getElementById('kyc-upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Solde + prix réels (le serveur applique la remise de renouvellement Bleu)
  useEffect(() => {
    if (!profile) return;
    let off = false;
    (async () => {
      const [w, grey, blue] = await Promise.all([
        getWallet(profile.id),
        getCertificationPrice(profile.id, 'grey', period),
        getCertificationPrice(profile.id, 'blue', period),
      ]);
      if (off) return;
      setBalance(w.balance);
      setPrices({ grey: grey ?? (annual ? 15000 : 1500), blue: blue ?? (annual ? 40000 : 4000) });
    })();
    return () => { off = true; };
  }, [profile?.id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Étape 1 : contrôles préalables, puis ouverture du récapitulatif. Aucun débit ici. */
  function askPay(level: 'grey' | 'blue') {
    // 1) L'identité passe AVANT tout le reste : ni le solde ni la formule ne comptent
    //    tant que les pièces ne sont pas déposées et validées.
    if (!canPay) { setKycGate(true); return; }
    // 2) Ensuite seulement, le solde.
    if (balance < (prices[level] ?? 0)) {
      toast.error('Solde insuffisant — rechargez votre portefeuille.');
      navigate('/wallet');
      return;
    }
    setConfirmLevel(level);
  }

  /** Étape 2 : l'utilisateur a confirmé dans la modale — c'est ici que le solde est débité. */
  async function confirmPay() {
    const level = confirmLevel;
    if (!level) return;
    setPaying(level);
    try {
      const exp = await payCertification(level, period);
      await refreshProfile();
      const w = await getWallet(profile!.id);
      setBalance(w.balance);
      setConfirmLevel(null);
      toast.success(
        kycVerified
          ? `Certification active jusqu'au ${new Date(exp).toLocaleDateString('fr-FR')}.`
          : 'Paiement reçu. Vos pièces sont en cours de vérification (24 à 48 h).',
      );
    } catch (e) {
      toast.error((e as Error).message || 'Paiement impossible');
    } finally { setPaying(null); }
  }

  async function doCancel() {
    setCancelling(true);
    try {
      const amount = await cancelCertification();
      await refreshProfile();
      const w = await getWallet(profile!.id);
      setBalance(w.balance);
      toast.success(`Abonnement annulé — ${formatCFA(amount)} recrédités.`);
    } catch (e) {
      toast.error((e as Error).message || 'Annulation impossible');
    } finally { setCancelling(false); }
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Faites-vous certifier
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)', maxWidth: 560, margin: '0 auto' }}>
            Inspirez confiance aux organisateurs et décrochez plus de missions. La certification est un <b style={{ color: 'var(--color-gold-primary)' }}>badge de professionnalisme</b> — pas une obligation.
          </p>
        </div>

        {/* ── Étape préalable obligatoire : vérification de l'identité ── */}
        {!canPay && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              background: kycPending ? 'rgba(245,158,11,0.10)' : 'rgba(59,130,246,0.10)',
              border: `1px solid ${kycPending ? 'rgba(245,158,11,0.40)' : 'rgba(59,130,246,0.40)'}`,
              borderRadius: 16, padding: '18px 20px', marginBottom: 26,
            }}>
            <div style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: kycPending ? 'rgba(245,158,11,0.20)' : 'rgba(59,130,246,0.20)',
            }}>
              {kycPending ? <Clock size={19} color="#f59e0b" /> : <ShieldCheck size={19} color="#3b82f6" />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 5 }}>
                {kycPending
                  ? 'Étape 1 sur 2 — Vérification en cours'
                  : kycRejected
                  ? 'Vos pièces ont été refusées'
                  : 'Étape 1 sur 2 — Faites vérifier votre identité'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                {kycPending ? (
                  <>Nous contrôlons votre pièce d’identité — comptez <b>24 à 48 h</b>. Vous recevrez une
                  notification dès la validation, et vous pourrez alors choisir et régler votre formule.</>
                ) : kycRejected ? (
                  <>Votre document n’a pas pu être validé. Renvoyez une photo <b>nette et complète</b> de votre
                  pièce d’identité (recto et verso) pour débloquer la certification.</>
                ) : (
                  <>Avant de choisir une formule, votre identité doit être vérifiée : c’est ce qui donne sa valeur
                  au badge auprès des organisateurs. <b>Envoyez votre pièce d’identité</b> (recto et verso) —
                  nous la contrôlons sous 24 à 48 h. Le choix de la formule et le paiement ne sont
                  débloqués qu’après cette validation.</>
                )}
              </p>

              {!kycPending && (
                <button onClick={goUpload}
                  className="btn-gold px-5 py-2 rounded-xl text-sm font-bold text-[#261642]"
                  style={{ marginTop: 12 }}>
                  {kycRejected ? 'Renvoyer mes pièces' : 'Envoyer mes pièces'}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Bascule mensuel / annuel */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {(['mois', 'an'] as const).map((p, i) => {
            const isAnnual = i === 1;
            const active = annual === isAnnual;
            return (
              <button key={p} onClick={() => setAnnual(isAnnual)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={active
                  ? { background: 'var(--color-gold-primary)', color: '#261642' }
                  : { background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid rgba(201,168,76,0.2)' }}>
                {isAnnual ? 'Annuel' : 'Mensuel'}
                {isAnnual && <span style={{ marginLeft: 6, fontSize: 11, color: active ? '#261642' : '#00C896' }}>2 mois offerts</span>}
              </button>
            );
          })}
        </div>

        {/* Cartes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan, index) => {
            const isCurrent = current === plan.key;
            const isFree = plan.key === 'none';
            const price = isFree ? 0 : (prices[plan.key] ?? (annual ? plan.yearly : plan.monthly));
            const listPrice = annual ? plan.yearly : plan.monthly;
            const discounted = !isFree && price < listPrice;
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  background: 'var(--color-bg-card)', borderRadius: 18, padding: '26px 22px',
                  border: plan.popular ? `2px solid ${plan.color}` : '1px solid var(--color-border)',
                  boxShadow: plan.popular ? `0 0 30px ${plan.color}22` : 'var(--card-shadow)',
                }}>
                {/* Badge populaire */}
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '3px 12px', borderRadius: 999, letterSpacing: '0.04em',
                    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}>
                    <Star size={12} fill="currentColor" /> RECOMMANDÉ
                  </div>
                )}

                {/* Nom */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <plan.Icon size={18} color={plan.color} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{plan.name}</span>
                </div>

                {/* Prix */}
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  {isFree ? (
                    <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-gold-primary)' }}>Gratuit</span>
                  ) : (
                    <>
                      {discounted && (
                        <span style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'line-through', marginRight: 8 }}>
                          {formatCFA(listPrice)}
                        </span>
                      )}
                      <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-gold-primary)' }}>{formatCFA(price)}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}> /{annual ? 'an' : 'mois'}</span>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: discounted ? '#00C896' : 'var(--color-text-muted)', marginTop: 4, minHeight: 14 }}>
                    {isFree ? '' : discounted ? 'remise fidélité Bleu appliquée'
                      : annual ? 'facturé une fois par an' : 'facturé chaque mois'}
                  </div>
                </div>

                {/* Avantages */}
                <ul style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      <Check size={14} color={plan.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ textAlign: 'left' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={isFree ? undefined : () => askPay(plan.key as 'grey' | 'blue')}
                  disabled={isFree || paying !== null}
                  style={{
                    marginTop: 20, width: '100%', padding: '11px', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: isFree ? 'default' : 'pointer',
                    border: plan.popular ? 'none' : `1px solid ${plan.color}55`,
                    background: plan.popular ? `linear-gradient(135deg, ${plan.color}, #60a5fa)`
                      : isFree ? 'var(--color-surface)' : 'transparent',
                    color: plan.popular ? '#fff' : isFree ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    opacity: isFree ? 0.7 : !canPay ? 0.5 : 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                  {isFree ? 'Formule par défaut' : !canPay ? (
                    <><Lock size={14} /> Identité à vérifier</>
                  ) : (
                    <>
                      <WalletIcon size={15} />
                      {isCurrent && isActive ? 'Renouveler' : `Choisir — ${formatCFA(price)}`}
                    </>
                  )}
                </button>
                {!isFree && (
                  <p style={{ fontSize: 10.5, textAlign: 'center', marginTop: 7, color: canPay ? 'var(--color-text-muted)' : '#f59e0b' }}>
                    {canPay ? 'récapitulatif avant paiement'
                      : kycPending ? 'vérification en cours (24-48 h)' : 'envoyez vos pièces pour débloquer'}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Note paiement */}
        <div className="text-center text-xs mt-6" style={{ color: 'var(--color-text-muted)', maxWidth: 620, margin: '24px auto 0' }}>
          <p>
            💡 Le règlement se fait <b style={{ color: 'var(--color-text-secondary)' }}>depuis votre portefeuille</b> — rechargez-le par
            mobile money (Orange · MTN · Moov · Wave), puis choisissez votre formule.
            {' '}Solde actuel : <b style={{ color: 'var(--color-gold-primary)' }}>{formatCFA(balance)}</b>
            {' · '}
            <button onClick={() => navigate('/wallet')} style={{ color: 'var(--color-gold-primary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}>
              recharger
            </button>
          </p>
          {isActive && current !== 'none' && (
            <>
              <p style={{ marginTop: 8, color: '#00C896' }}>
                ✅ Certification {current === 'blue' ? 'Bleue' : 'Grise'} active jusqu'au {expiresAt!.toLocaleDateString('fr-FR')}.
              </p>
              {/* Filet de sécurité : ne s'affiche que si l'identité a été invalidée après coup. */}
              {!kycVerified && (
                <button onClick={doCancel} disabled={cancelling}
                  style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                    color: 'var(--color-text-muted)', textDecoration: 'underline' }}>
                  {cancelling ? 'Annulation…' : 'Annuler mon abonnement et être remboursé'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Zone d'envoi des pièces (KYC) */}
        <div id="kyc-upload" style={{ marginTop: 28 }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Mes pièces {!canPay && <span style={{ fontSize: 12, fontWeight: 500, color: '#f59e0b' }}>— étape obligatoire</span>}
          </h2>
          <KycCard alwaysShow offersLink={false} />
        </div>
      </div>

      {/* ── Formulaire bloquant : pièces obligatoires avant toute suite ── */}
      {kycGate && (
        <div onClick={() => setKycGate(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, background: 'rgba(15,10,30,0.85)' }}>
          <div onClick={e => e.stopPropagation()} className="card-glass p-6 w-full" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: kycPending ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)' }}>
                {kycPending ? <Clock size={20} color="#f59e0b" /> : <ShieldCheck size={20} color="#3b82f6" />}
              </div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)', fontSize: 16 }}>
                {kycPending ? 'Vérification en cours' : "Pièce d'identité obligatoire"}
              </h3>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {kycPending ? (
                <>Nous contrôlons actuellement votre pièce d’identité. Comptez <b>24 à 48 h</b> :
                vous recevrez une notification dès la validation, et vous pourrez alors régler votre formule.</>
              ) : kycRejected ? (
                <>Votre document n’a pas pu être validé. Renvoyez une photo <b>nette et complète</b> de
                votre pièce d’identité (recto <i>et</i> verso) pour débloquer la certification.</>
              ) : (
                <>Avant de souscrire, vous devez <b>obligatoirement</b> faire vérifier votre identité.
                Envoyez votre pièce d’identité (recto <i>et</i> verso) : nos équipes la contrôlent sous
                <b> 24 à 48 h</b>. Le paiement ne sera possible qu’une fois cette vérification validée.</>
              )}
            </p>

            {/* Rappel du parcours */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                ["Envoyer vos pièces d'identité", hasDocs],
                ['Vérification par notre équipe (24-48 h)', kycVerified],
                ['Choisir et régler votre formule', false],
              ].map(([label, done], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'rgba(0,200,150,0.18)' : 'var(--color-surface)',
                    color: done ? '#00C896' : 'var(--color-text-muted)',
                    border: `1px solid ${done ? 'rgba(0,200,150,0.4)' : 'rgba(201,168,76,0.2)'}`,
                  }}>{done ? <Check size={12} /> : i + 1}</span>
                  <span style={{ color: done ? '#00C896' : 'var(--color-text-secondary)' }}>{label as string}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setKycGate(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                  border: '1px solid rgba(201,168,76,0.2)' }}>
                Fermer
              </button>
              {!kycPending && (
                <button type="button"
                  onClick={() => { setKycGate(false); goUpload(); }}
                  className="flex-1 btn-gold py-2.5 rounded-xl text-sm font-bold text-[#261642]">
                  {kycRejected ? 'Renvoyer mes pièces' : 'Envoyer mes pièces'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Récapitulatif avant débit ─────────────────────────────── */}
      {confirmLevel && (() => {
        const plan = PLANS.find(p => p.key === confirmLevel)!;
        const price = prices[confirmLevel] ?? 0;
        const until = new Date(Math.max(expiresAt?.getTime() ?? 0, Date.now()));
        if (annual) until.setFullYear(until.getFullYear() + 1); else until.setMonth(until.getMonth() + 1);
        const busy = paying !== null;
        return (
          <div onClick={() => !busy && setConfirmLevel(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 16, background: 'rgba(15,10,30,0.85)' }}>
            <div onClick={e => e.stopPropagation()} className="card-glass p-6 w-full" style={{ maxWidth: 420 }}>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Confirmer votre certification
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Vérifiez avant de valider : le montant sera débité de votre portefeuille.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
                {[
                  ['Formule', plan.name],
                  ['Durée', annual ? '1 an' : '1 mois'],
                  ['Valable jusqu’au', until.toLocaleDateString('fr-FR')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'rgba(201,168,76,0.18)', margin: '3px 0' }} />
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Montant à payer</span>
                  <span style={{ color: 'var(--color-gold-primary)', fontWeight: 800, fontSize: 16 }}>{formatCFA(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Solde après paiement</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatCFA(balance - price)}</span>
                </div>
              </div>

              <p style={{ fontSize: 11, marginTop: 14, color: 'var(--color-text-muted)' }}>
                Votre identité étant vérifiée, votre badge sera actif immédiatement après le paiement.
              </p>

              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setConfirmLevel(null)} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                    border: '1px solid rgba(201,168,76,0.2)' }}>
                  Annuler
                </button>
                <button type="button" onClick={confirmPay} disabled={busy}
                  className="flex-1 btn-gold py-2.5 rounded-xl text-sm font-bold text-[#261642] disabled:opacity-60">
                  {busy ? 'Paiement…' : 'Confirmer le paiement'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
