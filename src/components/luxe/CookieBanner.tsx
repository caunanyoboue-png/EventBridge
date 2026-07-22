import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';

const KEY = 'eb-cookie-consent';

/** Bannière de consentement cookies (choix mémorisé en localStorage). */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setVisible(true); } catch { /* ignore */ }
  }, []);

  function decide(choice: 'all' | 'essential') {
    try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 70,
            maxWidth: 660, margin: '0 auto',
            background: 'var(--eb-l-card)', border: '1px solid var(--color-card-border)',
            borderRadius: 16, boxShadow: 'var(--card-shadow)', backdropFilter: 'blur(14px)',
            padding: '15px 18px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
          }}
        >
          <Cookie size={22} color="var(--color-gold-primary)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1, minWidth: 200, margin: 0, lineHeight: 1.55 }}>
            Nous utilisons des cookies pour améliorer votre expérience. Choisissez ce que vous acceptez.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => decide('essential')} className="btn-outline-gold"
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}>
              Essentiels
            </button>
            <button onClick={() => decide('all')} className="btn-gold"
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12.5, color: '#1a1a2e' }}>
              Tout accepter
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
