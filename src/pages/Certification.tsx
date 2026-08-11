import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, BadgeCheck, Crown, Star, Wallet as WalletIcon } from 'lucide-react';
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
  const [cancelling, setCancelling] = useState(false);
  const current = (profile?.certification_level || 'none') as CertificationLevel;
  const period = annual ? 'year' : 'month';

  const expiresAt = profile?.certification_expires_at
    ? new Date(profile.certification_expires_at) : null;
  const isActive = !!expiresAt && expiresAt > new Date();
  const kycVerified = profile?.kyc_status === 'verified';
  // Les pièces doivent être déposées avant tout paiement (en cours de contrôle ou déjà validées).
  const piecesSent = profile?.kyc_status === 'pending' || kycVerified;

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
    if (!piecesSent) {
      toast.error("Envoyez d'abord votre pièce d'identité, puis réglez votre certification.");
      goUpload();
      return;
    }
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
                    opacity: isFree ? 0.7 : !piecesSent ? 0.55 : 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                  {isFree ? 'Formule par défaut' : (
                    <>
                      <WalletIcon size={15} />
                      {isCurrent && isActive ? 'Renouveler' : `Choisir — ${formatCFA(price)}`}
                    </>
                  )}
                </button>
                {!isFree && (
                  <p style={{ fontSize: 10.5, textAlign: 'center', marginTop: 7, color: piecesSent ? 'var(--color-text-muted)' : '#f59e0b' }}>
                    {piecesSent ? 'récapitulatif avant paiement' : "envoyez d'abord vos pièces ↓"}
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
              <p style={{ marginTop: 8, color: kycVerified ? '#00C896' : '#f59e0b' }}>
                {kycVerified
                  ? `✅ Certification ${current === 'blue' ? 'Bleue' : 'Grise'} active jusqu'au ${expiresAt!.toLocaleDateString('fr-FR')}.`
                  : `⏳ Paiement reçu — vos pièces sont en cours de vérification (24 à 48 h). Votre badge s'activera dès validation. Abonnement valable jusqu'au ${expiresAt!.toLocaleDateString('fr-FR')}.`}
              </p>
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
            Mes pièces {!piecesSent && <span style={{ fontSize: 12, fontWeight: 500, color: '#f59e0b' }}>— à envoyer avant le paiement</span>}
          </h2>
          <KycCard alwaysShow offersLink={false} />
        </div>
      </div>

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
                {kycVerified
                  ? 'Votre badge sera actif immédiatement.'
                  : 'Vos pièces seront vérifiées sous 24 à 48 h. Tant qu’elles ne sont pas validées, vous pouvez annuler et être remboursé.'}
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
