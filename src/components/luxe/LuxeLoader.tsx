import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Écran de chargement d'entrée : anneau doré + monogramme, se dissout après un instant. */
export default function LuxeLoader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 950);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--eb-l-root)',
          }}
        >
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-gold-primary)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-gold-primary)', fontFamily: "'Playfair Display', serif",
              fontWeight: 700, fontSize: 24,
            }}>E</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
