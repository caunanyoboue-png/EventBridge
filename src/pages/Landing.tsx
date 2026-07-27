import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import Logo, { LogoMark } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import LuxeLoader from '../components/luxe/LuxeLoader';
import BackToTop from '../components/luxe/BackToTop';
import CookieBanner from '../components/luxe/CookieBanner';
import AnimatedCounter from '../components/luxe/AnimatedCounter';
import { COMPETENCES, VILLES } from '../lib/utils';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const HERO_BG  = "/images/page d'accueil eventbridge.png";
const IMG_FREE = '/images/service en salle.png';
const IMG_ORG  = "/images/Les meilleurs talents pour vos événements.jpeg";
const IMG_SOS  = 'https://images.pexels.com/photos/2306281/pexels-photo-2306281.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';

const SERVICES = [
  { img: '/images/service en salle.png',                                                                              label: 'Service en salle' },
  { img: '/images/Bar & Barman.png',                                                                                  label: 'Bar & Barman' },
  { img: 'https://images.pexels.com/photos/9008769/pexels-photo-9008769.jpeg?auto=compress&cs=tinysrgb&w=600&q=80',  label: 'Animation & MC' },
  { img: "/images/page d'accueil eventbridge.png",                                                                    label: 'Son & Lumière' },
  { img: '/images/hotesse Accueil.png',                                                                               label: 'Hôtesse Accueil' },
  { img: '/images/Securite.png',                                                                                      label: 'Sécurité' },
  { img: '/images/Photo & Video.jpg',                                                                                 label: 'Photo & Vidéo' },
  { img: '/images/Chauffeur VIP.jpg',                                                                                 label: 'Chauffeur VIP' },
  { img: '/images/logistique.jpeg',                                                                                   label: 'Logistique' },
];

const STEPS = [
  { n: '01', title: 'Publiez votre besoin',    desc: 'Type de prestation, date, lieu, budget : décrivez votre événement en quelques minutes, nous nous chargeons du reste.' },
  { n: '02', title: 'Rencontrez vos talents',  desc: 'Les meilleurs profils de votre ville se présentent à vous : vérifiés, notés, prêts à briller pour votre événement.' },
  { n: '03', title: 'Vivez votre événement',   desc: 'Contrats, paiements sécurisés, évaluations : tout est orchestré sur la plateforme. Vous, profitez du moment.' },
];

const TESTIMONIALS = [
  { name: 'Adjoua Konan', company: 'Hôtel Tiama Abidjan', role: 'Organisatrice', rating: 5,
    text: 'EventBridge a révolutionné notre façon de recruter. En quelques clics, nous trouvons des extras de qualité pour nos galas.',
    avatar: 'https://images.pexels.com/photos/5999825/pexels-photo-5999825.jpeg?auto=compress&cs=tinysrgb&w=150&q=80' },
  { name: 'Kouassi Amani', company: 'Freelance Barman', role: 'Freelance', rating: 5,
    text: 'Grâce à EventBridge, j\'ai triplé mes revenus. La plateforme est simple et les paiements sont toujours ponctuels.',
    avatar: 'https://images.pexels.com/photos/7562644/pexels-photo-7562644.jpeg?auto=compress&cs=tinysrgb&w=150&q=80' },
  { name: 'Ibrahim Keïta', company: 'Club Med CI', role: 'Directeur Évènements', rating: 5,
    text: 'Le S.O.S Brigade est une révolution. En 10 minutes, 3 serveurs confirmés pour une soirée de dernière minute.',
    avatar: 'https://images.pexels.com/photos/8302396/pexels-photo-8302396.jpeg?auto=compress&cs=tinysrgb&w=150&q=80' },
  { name: 'Mariam Touré', company: 'Freelance Hôtesse', role: 'Freelance', rating: 5,
    text: 'Un profil soigné, des missions près de chez moi, et une réputation qui grandit. EventBridge a changé mon quotidien.',
    avatar: 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=150&q=80' },
  { name: 'Serge Yao', company: 'Palm Club Hôtel', role: 'Directeur F&B', rating: 5,
    text: 'Des équipes fiables, des contrats en règle et une facturation limpide. Exactement ce que cherche un professionnel.',
    avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=150&q=80' },
];

const FREELANCE_AVANTAGES = [
  'Des centaines de missions premium publiées chaque semaine, près de chez vous',
  'Paiements sécurisés et garantis dès la validation de la mission',
  'Une réputation qui grandit avec vous, évaluation après évaluation',
  'Alerte S.O.S : soyez mobilisé en temps réel sur les missions urgentes',
];
const ORG_AVANTAGES = [
  'Des profils vérifiés et certifiés, sélectionnés en quelques minutes',
  'Filtrez par compétence, disponibilité, ville et tarif',
  'Équipes, contrats et paiements réunis dans un seul écrin',
  'Mobilisation d\'urgence avec le S.O.S Brigade en moins de 10 minutes',
];

const STATS: { to: number; suffix?: string; decimals?: number; label: string }[] = [
  { to: 500, suffix: '+', label: 'Freelances actifs' },
  { to: 1200, suffix: '+', label: 'Missions réalisées' },
  { to: 4.8, decimals: 1, label: 'Note moyenne' },
  { to: 98, suffix: '%', label: 'Satisfaction client' },
];

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: ((i * 37 + 11) % 97) + 1.5,
  top: ((i * 53 + 7) % 83) + 5,
  size: 2 + ((i * 13) % 3),
  delay: (i * 0.45) % 4,
  duration: 2.6 + ((i * 7) % 30) / 10,
}));

// ── Icônes SVG inline (or via variable de thème) ──
function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconArrow() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconWarning() {
  return <svg width="52" height="52" viewBox="0 0 52 52" fill="none"><path d="M26 6L48 44H4L26 6Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/><path d="M26 22v10M26 36v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}
function IconStepPost() {
  return <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><path d="M7 5h14l7 7v18H7V5Z" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinejoin="round"/><path d="M21 5v7h7" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 16h10M12 20h10M12 24h6" stroke="var(--color-gold-primary)" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
function IconStepMatch() {
  return <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><circle cx="12" cy="12" r="5.5" stroke="var(--color-gold-primary)" strokeWidth="1.8"/><circle cx="24" cy="12" r="5.5" stroke="var(--color-gold-primary)" strokeWidth="1.8"/><path d="M3 30c0-5 4-9 9-9h10c5 0 9 4 9 9" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function IconStepDone() {
  return <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><circle cx="17" cy="17" r="13" stroke="var(--color-gold-primary)" strokeWidth="1.8"/><path d="M11 17.5l4.5 4.5 8-9" stroke="var(--color-gold-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconStar({ filled }: { filled: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill={filled ? 'var(--color-gold-primary)' : 'none'}><path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L7 1Z" stroke="var(--color-gold-primary)" strokeWidth="1" strokeLinejoin="round"/></svg>;
}

// ── Révélation au scroll ──
function Reveal({ children, delay = 0, y = 30, className, style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// Petit libellé de section « kicker » doré — bloc à part entière (sa propre ligne),
// centré dans les sections centrées, aligné à gauche dans les colonnes.
function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5">
      <span className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-widest uppercase"
        style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.18em' }}>
        <span style={{ width: 26, height: 1, background: 'var(--color-gold-primary)', display: 'inline-block', opacity: 0.6 }} />
        {children}
        <span style={{ width: 26, height: 1, background: 'var(--color-gold-primary)', display: 'inline-block', opacity: 0.6 }} />
      </span>
    </p>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const reduceMotion = useReducedMotion();

  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('accueil');
  const [skill, setSkill] = useState('');
  const [ville, setVille] = useState('');
  const [email, setEmail] = useState('');
  const [testi, setTesti] = useState(0);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, 150]);

  useEffect(() => {
    if (user && profile) navigate('/dashboard');
  }, [user, profile, navigate]);

  useEffect(() => {
    const ids = ['comment', 'services', 'temoignages'];
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const mid = window.scrollY + window.innerHeight * 0.35;
      let cur = 'accueil';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= mid) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Rotation automatique du carrousel de témoignages
  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => setTesti(i => (i + 1) % TESTIMONIALS.length), 5500);
    return () => clearInterval(t);
  }, [reduceMotion]);

  function runSearch() {
    const params = new URLSearchParams();
    if (skill) params.set('skill', skill);
    if (ville) params.set('ville', ville);
    navigate(`/missions${params.toString() ? `?${params}` : ''}`);
  }

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { toast.error('Entrez une adresse email valide.'); return; }
    toast.success('Merci ! Vous recevrez nos meilleures missions.');
    setEmail('');
  }

  const navLinks = [
    { id: 'accueil', label: 'Accueil', href: '#top' },
    { id: 'comment', label: 'Comment ça marche', href: '#comment' },
    { id: 'services', label: 'Services', href: '#services' },
    { id: 'temoignages', label: 'Témoignages', href: '#temoignages' },
  ];

  return (
    <div className="min-h-screen eb-landing" style={{ background: 'var(--eb-l-root)', color: 'var(--color-text-primary)' }}>
      <LuxeLoader />

      {/* ── NAVBAR flottante (pilule + blur) ── */}
      <nav className="fixed top-3 left-3 right-3 md:top-4 md:left-4 md:right-4 z-50 flex justify-center">
        <div className="w-full max-w-6xl flex items-center justify-between gap-4 px-4 md:px-6 rounded-full"
          style={{
            height: 62,
            background: 'var(--color-header-bg)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid var(--color-border)',
            boxShadow: scrolled ? 'var(--eb-card-shadow)' : 'var(--card-shadow)',
            transition: 'box-shadow 0.35s ease',
          }}>
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex' }}>
            <Logo height={38} />
          </div>

          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(l => (
              <a key={l.id} href={l.href}
                onClick={l.id === 'accueil' ? (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } : undefined}
                className="relative text-sm font-medium transition-colors py-1"
                style={{ color: active === l.id ? 'var(--color-gold-primary)' : 'var(--color-text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = active === l.id ? 'var(--color-gold-primary)' : 'var(--color-text-secondary)')}>
                {l.label}
                {active === l.id && <span style={{ position: 'absolute', left: 2, right: 2, bottom: -3, height: 2, borderRadius: 2, background: 'var(--color-gold-primary)' }} />}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle compact />
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-5 md:px-6 py-2.5 rounded-full text-sm font-bold" style={{ color: '#1a1a2e' }}>
              Connexion
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0" style={reduceMotion ? undefined : { y: heroY }}>
          <img src={HERO_BG} alt="Événement d'exception en Côte d'Ivoire" className="w-full h-full object-cover" style={{ transform: 'scale(1.1)' }} />
          <div className="absolute inset-0" style={{ background: 'var(--eb-l-hero-veil)' }} />
          {!reduceMotion && (
            <div className="absolute animate-aurora" style={{
              width: '70vw', height: '70vw', left: '15%', top: '-10%',
              background: 'radial-gradient(circle, rgba(201,151,44,0.12) 0%, rgba(201,151,44,0.05) 40%, transparent 70%)',
              filter: 'blur(46px)', pointerEvents: 'none',
            }} />
          )}
          {!reduceMotion && PARTICLES.map((p, i) => (
            <span key={i} className="absolute rounded-full" style={{
              left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size,
              background: 'var(--color-gold-light)', boxShadow: '0 0 8px rgba(201,151,44,0.7)',
              animation: `twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`, pointerEvents: 'none',
            }} />
          ))}
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-28 pb-44">
          <Reveal delay={0.1} y={16}>
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-9"
              style={{ background: 'var(--eb-l-glass-btn-bg)', border: '1px solid var(--color-border)', backdropFilter: 'blur(8px)' }}>
              <span className="animate-glow" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-gold-primary)', display: 'inline-block' }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.12em' }}>
                LA 1ᵉ PLATEFORME DE L'ÉVÉNEMENTIEL EN CÔTE D'IVOIRE
              </span>
            </div>
          </Reveal>

          <h1 className="font-display font-bold mb-7"
            style={{ fontSize: 'clamp(2.5rem, 5.6vw, 5rem)', color: 'var(--eb-l-hero-title)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Le pont entre <span className="text-gold-gradient">talents</span><br />et <span className="text-gold-gradient">opportunités</span>
          </h1>

          <Reveal delay={0.3} y={18}>
            <p className="text-lg mb-8 max-w-lg mx-auto" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.75 }}>
              Des galas d'Abidjan aux soirées de Grand-Bassam : confiez vos événements aux meilleurs
              talents du pays, ou décrochez les missions qui vous ressemblent.
            </p>
          </Reveal>

          {/* Barre de recherche */}
          <Reveal delay={0.42} y={18}>
            <div className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl mx-auto max-w-2xl mb-8"
              style={{ background: 'var(--eb-l-card)', border: '1px solid var(--color-border)', backdropFilter: 'blur(12px)', boxShadow: 'var(--card-shadow)' }}>
              <select value={skill} onChange={e => setSkill(e.target.value)} aria-label="Compétence recherchée"
                className="flex-1 px-4 py-3 rounded-full text-sm outline-none cursor-pointer"
                style={{ background: 'transparent', color: 'var(--color-text-primary)', border: 'none' }}>
                <option value="" style={{ color: '#1a1a2e' }}>Quelle prestation ?</option>
                {COMPETENCES.map(c => <option key={c} value={c} style={{ color: '#1a1a2e' }}>{c}</option>)}
              </select>
              <span className="hidden sm:block" style={{ width: 1, background: 'var(--color-border)' }} />
              <select value={ville} onChange={e => setVille(e.target.value)} aria-label="Ville"
                className="flex-1 px-4 py-3 rounded-full text-sm outline-none cursor-pointer"
                style={{ background: 'transparent', color: 'var(--color-text-primary)', border: 'none' }}>
                <option value="" style={{ color: '#1a1a2e' }}>Où ?</option>
                {VILLES.map(v => <option key={v} value={v} style={{ color: '#1a1a2e' }}>{v}</option>)}
              </select>
              <button onClick={runSearch}
                className="btn-gold px-6 py-3 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2"
                style={{ color: '#1a1a2e' }}>
                <Search size={16} /> Rechercher
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.52} y={18}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate('/onboarding')}
                className="btn-gold px-8 py-4 rounded-full font-bold text-sm flex items-center gap-3 justify-center w-full sm:w-auto"
                style={{ color: '#1a1a2e', letterSpacing: '0.04em' }}>
                Je suis Freelance <IconArrow />
              </button>
              <button onClick={() => navigate('/pour-les-organisateurs')}
                className="px-8 py-4 rounded-full font-bold text-sm flex items-center gap-3 justify-center w-full sm:w-auto cursor-pointer transition-colors"
                style={{ background: 'var(--eb-l-glass-btn-bg)', border: '1.5px solid var(--eb-l-glass-btn-border)', color: 'var(--color-text-primary)', backdropFilter: 'blur(8px)', letterSpacing: '0.04em' }}>
                Je suis Organisateur
              </button>
            </div>
            <div className="mt-6">
              <button onClick={() => navigate('/feed')}
                className="text-sm font-medium inline-flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}>
                Explorer le fil <IconArrow />
              </button>
            </div>
          </Reveal>
        </div>

        {/* Stats — compteurs animés */}
        <div className="absolute bottom-0 left-0 right-0 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 rounded-t-2xl overflow-hidden"
              style={{ background: 'var(--eb-l-card)', backdropFilter: 'blur(24px)', border: '1px solid var(--color-border)', borderBottom: 'none' }}>
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={0.15 + i * 0.1} y={20} className="py-5 text-center"
                  style={{ borderRight: i < 3 ? '1px solid var(--color-border)' : 'none' }}>
                  <div className="text-2xl md:text-3xl font-bold text-gold-gradient font-display">
                    <AnimatedCounter to={s.to} suffix={s.suffix} decimals={s.decimals} />
                  </div>
                  <div className="text-xs mt-1 font-medium tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section id="comment" className="py-28 px-6" style={{ background: 'var(--eb-l-sec-a)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <Kicker>Simple &amp; Rapide</Kicker>
            <h2 className="font-display text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Trois étapes. Une équipe de rêve.</h2>
            <p className="mt-8 text-base" style={{ color: 'var(--color-text-muted)' }}>De votre idée à l'événement parfait, sans détour</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-[3.25rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px"
              style={{ background: 'linear-gradient(to right, var(--color-gold-primary), var(--color-border), var(--color-gold-primary))', opacity: 0.5 }} />
            {STEPS.map((s, idx) => (
              <Reveal key={s.n} delay={idx * 0.18} className="group flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
                    style={{ background: 'var(--eb-l-card)', border: '1.5px solid var(--color-border)' }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--eb-l-step-inner)', border: '1px solid var(--color-border)' }}>
                      {idx === 0 && <IconStepPost />}{idx === 1 && <IconStepMatch />}{idx === 2 && <IconStepDone />}
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--lux-gold-grad)', color: '#1a1a2e', boxShadow: '0 0 18px rgba(201,151,44,0.4)' }}>{s.n}</div>
                </div>
                <h3 className="font-display font-semibold text-2xl mb-4" style={{ color: 'var(--color-text-primary)' }}>{s.title}</h3>
                <p className="text-sm leading-loose max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── POUR LES FREELANCES ── */}
      <section style={{ background: 'var(--eb-l-sec-plum)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[520px]">
          <div className="relative overflow-hidden min-h-72">
            <img src={IMG_FREE} alt="Freelance en prestation événementielle" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'var(--eb-l-plum-fade-r)' }} />
          </div>
          <Reveal className="flex flex-col justify-center px-8 md:px-10 py-12 md:py-16" y={0}>
            <Kicker>Pour les Freelances</Kicker>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-8" style={{ color: 'var(--color-text-primary)' }}>Votre talent mérite une scène à sa hauteur</h2>
            <div className="space-y-4 mb-8">
              {FREELANCE_AVANTAGES.map((item, i) => (
                <Reveal key={item} delay={0.12 + i * 0.1} y={14}>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--eb-l-glass-btn-bg)', border: '1px solid var(--color-border)' }}><IconCheck /></div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-8 py-3 rounded-full font-bold self-start flex items-center gap-2 text-sm" style={{ color: '#1a1a2e' }}>
              Créer mon profil <IconArrow />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── POUR LES ORGANISATEURS ── */}
      <section style={{ background: 'var(--eb-l-sec-deep)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[520px]">
          <Reveal className="flex flex-col justify-center px-8 md:px-10 py-16 order-2 md:order-1" y={0}>
            <Kicker>Pour les Organisateurs</Kicker>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-8" style={{ color: 'var(--color-text-primary)' }}>Composez l'équipe que votre événement mérite</h2>
            <div className="space-y-4 mb-8">
              {ORG_AVANTAGES.map((item, i) => (
                <Reveal key={item} delay={0.12 + i * 0.1} y={14}>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--eb-l-glass-btn-bg)', border: '1px solid var(--color-border)' }}><IconCheck /></div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="btn-outline-gold px-8 py-3 rounded-full font-bold self-start flex items-center gap-2 text-sm">
              Publier une mission <IconArrow />
            </button>
          </Reveal>
          <div className="relative overflow-hidden min-h-72 order-1 md:order-2">
            <img src={IMG_ORG} alt="Organisateur composant son équipe" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'var(--eb-l-deep-fade-l)' }} />
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-28 px-6" style={{ background: 'var(--eb-l-root)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <Kicker>Nos Prestations</Kicker>
            <h2 className="font-display text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>L'excellence, dans chaque métier</h2>
            <p className="mt-8 text-base" style={{ color: 'var(--color-text-muted)' }}>Du service en salle à la sécurité, chaque prestation est portée par des professionnels passionnés</p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.12} y={26}>
                <div className="group relative overflow-hidden rounded-2xl cursor-pointer card-lift"
                  style={{ height: '210px', border: '1px solid var(--color-border)' }} onClick={() => navigate('/onboarding')}>
                  <img src={s.img} alt={s.label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0" style={{ background: 'var(--eb-l-img-bottom)' }} />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>{s.label}</p>
                    <p className="text-xs mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--eb-l-card-cta)' }}>
                      Voir les talents <IconArrow />
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── S.O.S BRIGADE ── */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <img src={IMG_SOS} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'rgba(90,10,10,0.88)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(255,60,60,0.08) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center animate-sos" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}><IconWarning /></div>
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,180,180,0.85)', letterSpacing: '0.15em' }}>Alerte Urgence</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" style={{ color: '#fff' }}>S.O.S Brigade</h2>
            <p className="text-lg mb-3 font-medium" style={{ color: 'rgba(255,255,255,0.88)' }}>Un imprévu à une heure du grand soir ?</p>
            <p className="text-base mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)', lineHeight: 1.8 }}>
              Déclenchez l'alerte : les freelances disponibles autour de votre événement sont prévenus en temps réel et confirmés en quelques minutes. Votre soirée est sauvée.
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-5 mb-10">
            {[{ v: '< 10 min', l: 'Temps de réponse moyen' }, { v: '10 km', l: 'Rayon de recherche' }, { v: '24h / 7j', l: 'Disponibilité' }].map((stat, i) => (
              <Reveal key={stat.l} delay={0.15 + i * 0.12} y={20}>
                <div className="text-center px-7 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div className="text-xl font-bold text-white">{stat.v}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4} y={16}>
            <button onClick={() => navigate('/onboarding')}
              className="px-10 py-4 rounded-full font-bold text-sm tracking-wide cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ background: 'white', color: '#b91c1c', letterSpacing: '0.04em' }}>Déclencher une alerte S.O.S</button>
          </Reveal>
        </div>
      </section>

      {/* ── TÉMOIGNAGES (carrousel) ── */}
      <section id="temoignages" className="py-28 px-6" style={{ background: 'var(--eb-l-sec-a)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <Reveal className="mb-12">
            <Kicker>Témoignages</Kicker>
            <h2 className="font-display text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>La confiance se gagne, événement après événement</h2>
          </Reveal>

          <div className="relative" style={{ minHeight: 300 }}>
            <AnimatePresence mode="wait">
              <motion.div key={testi}
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="p-8 md:p-10 rounded-2xl mx-auto"
                style={{ background: 'var(--eb-l-card)', border: '1px solid var(--color-card-border)', boxShadow: 'var(--card-shadow)' }}>
                <div className="flex justify-center gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => <IconStar key={j} filled={j < TESTIMONIALS[testi].rating} />)}
                </div>
                <p className="text-lg md:text-xl leading-relaxed mb-8 font-display italic" style={{ color: 'var(--color-text-primary)' }}>
                  « {TESTIMONIALS[testi].text} »
                </p>
                <div className="flex items-center justify-center gap-3">
                  <img src={TESTIMONIALS[testi].avatar} alt={TESTIMONIALS[testi].name}
                    className="w-12 h-12 rounded-full object-cover" style={{ border: '2px solid var(--color-gold-primary)' }} />
                  <div className="text-left">
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{TESTIMONIALS[testi].name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{TESTIMONIALS[testi].company} · {TESTIMONIALS[testi].role}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Contrôles */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button aria-label="Témoignage précédent" onClick={() => setTesti(i => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-gold-primary)', background: 'var(--eb-l-card)' }}><ChevronLeft size={18} /></button>
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, j) => (
                <button key={j} aria-label={`Témoignage ${j + 1}`} onClick={() => setTesti(j)}
                  className="rounded-full cursor-pointer transition-all" style={{
                    width: j === testi ? 22 : 8, height: 8,
                    background: j === testi ? 'var(--color-gold-primary)' : 'var(--color-border)',
                  }} />
              ))}
            </div>
            <button aria-label="Témoignage suivant" onClick={() => setTesti(i => (i + 1) % TESTIMONIALS.length)}
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-gold-primary)', background: 'var(--eb-l-card)' }}><ChevronRight size={18} /></button>
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER (bandeau anthracite) ── */}
      <section className="lux-ondark relative py-24 px-6 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #13131f 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(201,151,44,0.12) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <Reveal className="relative max-w-2xl mx-auto text-center">
          <Kicker>Newsletter</Kicker>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Ne manquez plus une opportunité</h2>
          <p className="text-base mb-8" style={{ color: 'var(--color-text-secondary)' }}>Les meilleures missions et les talents du moment, une fois par semaine dans votre boîte mail.</p>
          <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <label htmlFor="nl-email" className="sr-only">Adresse email</label>
            <input id="nl-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com" required
              className="flex-1 px-5 py-3.5 rounded-full text-sm outline-none"
              style={{ background: 'var(--eb-l-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            <button type="submit" className="btn-gold px-7 py-3.5 rounded-full font-bold text-sm" style={{ color: '#1a1a2e' }}>S'abonner</button>
          </form>
        </Reveal>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'var(--eb-l-cta-veil)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(201,151,44,0.06) 0%, transparent 65%)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <Reveal>
            <div className="flex justify-center mb-10"><LogoMark size={116} animated /></div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gold-gradient">Votre prochain événement</span><br />
              <span style={{ color: 'var(--color-text-primary)' }}>commence ici</span>
            </h2>
            <p className="text-sm mb-10 leading-relaxed" style={{ color: 'var(--color-text-muted)', lineHeight: 1.9 }}>
              Gratuit pour les freelances. Simple pour les organisateurs.<br />
              Des centaines de talents et de missions vous attendent, partout en Côte d'Ivoire.
            </p>
          </Reveal>
          <Reveal delay={0.2} y={18}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate('/onboarding')}
                className="btn-gold px-10 py-4 rounded-full font-bold text-sm flex items-center gap-2 justify-center" style={{ color: '#1a1a2e', letterSpacing: '0.04em' }}>
                Commencer maintenant <IconArrow />
              </button>
              <button onClick={() => navigate('/pour-les-organisateurs')} className="btn-outline-gold px-10 py-4 rounded-full font-bold text-sm">En savoir plus</button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-8" style={{ background: 'var(--eb-l-footer)', borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo height={40} />
          <div className="flex gap-8">
            {['À propos', 'Contact', 'CGU', 'Confidentialité'].map(link => (
              <a key={link} href="#" className="text-xs tracking-wide transition-colors" style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>{link}</a>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>© 2026 EventBridge · Côte d'Ivoire</p>
        </div>
      </footer>

      <BackToTop />
      <CookieBanner />
    </div>
  );
}
