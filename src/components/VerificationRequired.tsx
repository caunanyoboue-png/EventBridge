import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasIdentityDocs } from '../lib/kyc';

/**
 * Écran de blocage affiché à l'organisateur qui tente de publier une mission
 * ou de lancer un S.O.S Brigade sans identité vérifiée.
 * Le vrai verrou est côté base (trigger require_verified_organizer) : cet écran
 * évite simplement à l'utilisateur de remplir un formulaire pour rien.
 */
export default function VerificationRequired({ action = 'publier une mission' }: { action?: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const status = profile?.kyc_status || 'unverified';
  const envoye = hasIdentityDocs(profile) && status === 'pending';
  const refuse = status === 'rejected';

  const col = envoye ? '#f59e0b' : refuse ? '#ef4444' : '#3b82f6';
  const Icon = envoye ? Clock : refuse ? XCircle : ShieldAlert;

  return (
    <div className="card-glass p-7" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        width: 54, height: 54, borderRadius: '50%', margin: '0 auto 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${col}22`,
      }}>
        <Icon size={26} color={col} />
      </div>

      <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {envoye ? 'Vérification en cours' : refuse ? 'Dossier refusé' : 'Vérifiez votre identité'}
      </h2>

      <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        {envoye ? (
          <>Nous contrôlons vos pièces — comptez <b>24 à 48 h</b>. Vous recevrez une notification
          dès la validation et pourrez alors {action}.</>
        ) : refuse ? (
          <>Vos pièces n’ont pas pu être validées. Renvoyez des photos nettes et complètes
          (recto, verso et selfie tenant la pièce) pour pouvoir {action}.</>
        ) : (
          <>Pour {action}, votre identité doit d’abord être vérifiée : c’est ce qui protège les
          freelances qui acceptent vos missions. Envoyez <b>le recto et le verso</b> de votre pièce
          d’identité, plus <b>un selfie où l’on vous voit tenir cette pièce</b>. Contrôle sous 24 à 48 h.</>
        )}
      </p>

      {!envoye && (
        <button onClick={() => navigate('/profile')}
          className="btn-gold px-6 py-2.5 rounded-xl text-sm font-bold text-[#261642]"
          style={{ marginTop: 18 }}>
          {refuse ? 'Renvoyer mes pièces' : 'Envoyer mes pièces'}
        </button>
      )}

      <div style={{ marginTop: 14 }}>
        <button onClick={() => navigate('/feed')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5,
            color: 'var(--color-text-muted)', textDecoration: 'underline' }}>
          Retour au fil d’actualité
        </button>
      </div>
    </div>
  );
}
