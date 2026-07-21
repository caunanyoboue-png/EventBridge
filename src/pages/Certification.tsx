import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, BadgeCheck, Crown, Star } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import KycCard from '../components/KycCard';
import { useAuth } from '../contexts/AuthContext';
import { formatCFA } from '../lib/utils';
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
  const { profile } = useAuth();
  const [annual, setAnnual] = useState(false);
  const current = (profile?.certification_level || 'none') as CertificationLevel;

  const goUpload = () => document.getElementById('kyc-upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
                  ? { background: 'linear-gradient(135deg,var(--color-gold-primary),var(--color-gold-light))', color: '#261642' }
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
            const price = plan.key === 'none' ? 0 : annual ? plan.yearly : plan.monthly;
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  background: '#2a1a47', borderRadius: 18, padding: '26px 22px',
                  border: plan.popular ? `2px solid ${plan.color}` : '1px solid rgba(201,168,76,0.14)',
                  boxShadow: plan.popular ? `0 0 30px ${plan.color}22` : 'none',
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
                  {plan.key === 'none' ? (
                    <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-gold-primary)' }}>Gratuit</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-gold-primary)' }}>{formatCFA(price)}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}> /{annual ? 'an' : 'mois'}</span>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, minHeight: 14 }}>
                    {plan.key !== 'none' && (annual ? 'facturé une fois par an' : 'facturé chaque mois')}
                  </div>
                </div>

                {/* Avantages */}
                <ul style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#d8cdbb' }}>
                      <Check size={14} color={plan.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ textAlign: 'left' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={plan.key === 'none' ? undefined : goUpload}
                  disabled={plan.key === 'none' || isCurrent}
                  style={{
                    marginTop: 20, width: '100%', padding: '11px', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: plan.key === 'none' || isCurrent ? 'default' : 'pointer',
                    border: plan.popular ? 'none' : `1px solid ${plan.color}55`,
                    background: isCurrent ? 'rgba(0,200,150,0.15)'
                      : plan.popular ? `linear-gradient(135deg, ${plan.color}, #60a5fa)`
                      : plan.key === 'none' ? 'var(--color-surface)' : 'transparent',
                    color: isCurrent ? '#00C896' : plan.popular ? '#fff' : plan.key === 'none' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    opacity: plan.key === 'none' && !isCurrent ? 0.7 : 1,
                  }}>
                  {isCurrent ? 'Votre formule actuelle' : plan.key === 'none' ? 'Formule par défaut' : 'Envoyer mes pièces'}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Note paiement */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-muted)', maxWidth: 600, margin: '24px auto 0' }}>
          💡 Le paiement mobile money (Orange · MTN · Moov · Wave) arrive bientôt. En attendant, <b style={{ color: 'var(--color-text-secondary)' }}>envoie tes pièces</b> ci-dessous : notre équipe vérifie et t'attribue ton badge.
        </p>

        {/* Zone d'envoi des pièces (KYC) */}
        <div id="kyc-upload" style={{ marginTop: 28 }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Mes pièces</h2>
          <KycCard alwaysShow offersLink={false} />
        </div>
      </div>
    </DashboardLayout>
  );
}
