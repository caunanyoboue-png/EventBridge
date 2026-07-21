import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, type ReactNode, type CSSProperties } from 'react';
import Logo, { LogoMark } from '../components/Logo';

const HERO_BG  = "/images/page d'accueil eventbridge.png";
const IMG_FREE = '/images/service en salle.png';
const IMG_ORG  = "/images/Les meilleurs talents pour vos événements.jpeg";
const IMG_SOS  = 'https://images.pexels.com/photos/2306281/pexels-photo-2306281.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';

const SERVICES = [
  { img: '/images/service en salle.png',                                                                               label: 'Service en salle' },
  { img: '/images/Bar & Barman.png',                                                                                   label: 'Bar & Barman' },
  { img: 'https://images.pexels.com/photos/9008769/pexels-photo-9008769.jpeg?auto=compress&cs=tinysrgb&w=600&q=80',  label: 'Animation & MC' },
  { img: "/images/page d'accueil eventbridge.png",                                                                     label: 'Son & Lumière' },
  { img: '/images/hotesse Accueil.png',                                                                                label: 'Hôtesse Accueil' },
  { img: '/images/Securite.png',                                                                                       label: 'Sécurité' },
  { img: '/images/Photo & Video.jpg',                                                                                  label: 'Photo & Vidéo' },
  { img: '/images/Chauffeur VIP.jpg',                                                                                  label: 'Chauffeur VIP' },
  { img: '/images/logistique.jpeg',                                                                                    label: 'Logistique' },
];

const STEPS = [
  {
    n: '01',
    title: 'Publiez votre besoin',
    desc: 'Type de prestation, date, lieu, budget : décrivez votre événement en quelques minutes, nous nous chargeons du reste.',
  },
  {
    n: '02',
    title: 'Rencontrez vos talents',
    desc: 'Les meilleurs profils de votre ville se présentent à vous : vérifiés, notés, prêts à briller pour votre événement.',
  },
  {
    n: '03',
    title: 'Vivez votre événement',
    desc: 'Contrats, paiements sécurisés, évaluations : tout est orchestré sur la plateforme. Vous, profitez du moment.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Adjoua Konan', company: 'Hôtel Tiama Abidjan', role: 'Organisatrice', rating: 5,
    text: 'EventBridge a révolutionné notre façon de recruter. En quelques clics, nous trouvons des extras de qualité pour nos galas.',
    avatar: 'https://images.pexels.com/photos/5999825/pexels-photo-5999825.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
  {
    name: 'Kouassi Amani', company: 'Freelance Barman', role: 'Freelance', rating: 5,
    text: 'Grâce à EventBridge, j\'ai triplé mes revenus. La plateforme est simple et les paiements sont toujours ponctuels.',
    avatar: 'https://images.pexels.com/photos/7562644/pexels-photo-7562644.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
  {
    name: 'Ibrahim Keïta', company: 'Club Med CI', role: 'Directeur Évènements', rating: 5,
    text: 'Le S.O.S Brigade est une révolution. En 10 minutes, 3 serveurs confirmés pour une soirée de dernière minute.',
    avatar: 'https://images.pexels.com/photos/8302396/pexels-photo-8302396.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
];

// Icônes SVG inline
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconWarning() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <path d="M26 6L48 44H4L26 6Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M26 22v10M26 36v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconStepPost() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <path d="M7 5h14l7 7v18H7V5Z" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M21 5v7h7" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M12 16h10M12 20h10M12 24h6" stroke="var(--color-gold-primary)" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
function IconStepMatch() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="12" cy="12" r="5.5" stroke="var(--color-gold-primary)" strokeWidth="1.8"/>
      <circle cx="24" cy="12" r="5.5" stroke="var(--color-gold-primary)" strokeWidth="1.8"/>
      <path d="M3 30c0-5 4-9 9-9h10c5 0 9 4 9 9" stroke="var(--color-gold-primary)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IconStepDone() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="17" r="13" stroke="var(--color-gold-primary)" strokeWidth="1.8"/>
      <path d="M11 17.5l4.5 4.5 8-9" stroke="var(--color-gold-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill={filled ? 'var(--color-gold-primary)' : 'none'}>
      <path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L7 1Z"
        stroke="var(--color-gold-primary)" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  );
}

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

/* Particules dorées du hero — positions déterministes pour un rendu stable */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: ((i * 37 + 11) % 97) + 1.5,
  top: ((i * 53 + 7) % 83) + 5,
  size: 2 + ((i * 13) % 3),
  delay: (i * 0.45) % 4,
  duration: 2.6 + ((i * 7) % 30) / 10,
}));

/* Révélation au scroll — apparition douce, une seule fois */
function Reveal({
  children, delay = 0, y = 30, className, style,
}: { children: ReactNode; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (user && profile) navigate('/dashboard');
  }, [user, profile, navigate]);

  const heroWords = ['Le', 'pont', 'entre'];

  return (
    <div className="min-h-screen eb-landing" style={{ background: 'var(--eb-l-root)' }}>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{ background: 'var(--eb-l-nav)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--color-border)' }}>
        <Logo height={46} />

        <div className="hidden md:flex items-center gap-10">
          {[['#comment','Comment ça marche'],['#services','Services'],['#temoignages','Témoignages']].map(([href, label]) => (
            <a key={href} href={href}
              className="text-xs font-semibold tracking-widest uppercase transition-colors"
              style={{ color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}
              onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--color-gold-light)'; }}
              onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--color-text-muted)'; }}>
              {label}
            </a>
          ))}
        </div>

        <button onClick={() => navigate('/onboarding')}
          className="btn-gold px-6 py-2.5 rounded-lg text-sm font-bold"
          style={{ color: '#261642' }}>
          Connexion
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{ background: 'var(--eb-l-hero-veil)' }} />
          {/* Halo aurore doré en mouvement lent */}
          {!reduceMotion && (
            <div className="absolute animate-aurora" style={{
              width: '70vw', height: '70vw', left: '15%', top: '-10%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.10) 0%, rgba(107,74,158,0.08) 40%, transparent 70%)',
              filter: 'blur(40px)', pointerEvents: 'none',
            }} />
          )}
          {/* Constellation de particules dorées */}
          {!reduceMotion && PARTICLES.map((p, i) => (
            <span key={i} className="absolute rounded-full" style={{
              left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size,
              background: i % 3 === 0 ? '#f5e6c4' : 'var(--color-gold-primary)',
              boxShadow: '0 0 8px rgba(232,201,122,0.8)',
              animation: `twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
              pointerEvents: 'none',
            }} />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-56 sm:pb-44">
          {/* Badge */}
          <Reveal delay={0.1} y={16}>
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
              <span className="animate-glow" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-gold-primary)', display: 'inline-block' }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.1em' }}>
                LA 1ÈRE PLATEFORME DE L'ÉVÉNEMENTIEL EN CÔTE D'IVOIRE
              </span>
            </div>
          </Reveal>

          <h1 className="font-display font-bold mb-6 leading-tight"
            style={{ fontSize: 'clamp(2rem, 4.8vw, 4.2rem)', color: 'var(--eb-l-hero-title)' }}>
            {reduceMotion ? (
              <>Le pont entre <span className="text-gold-gradient">talents</span> et <span className="text-gold-gradient">opportunités</span></>
            ) : (
              <>
                {heroWords.map((w, i) => (
                  <motion.span key={w} className="inline-block"
                    initial={{ opacity: 0, y: 30, rotateX: 45 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 0.7, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                    {w}&nbsp;
                  </motion.span>
                ))}
                <motion.span className="text-gold-gradient inline-block"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}>
                  talents
                </motion.span>
                <motion.span className="inline-block"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                  &nbsp;et<br />
                </motion.span>
                <motion.span className="text-gold-gradient inline-block"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}>
                  opportunités
                </motion.span>
              </>
            )}
          </h1>

          <Reveal delay={1.15} y={18}>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
              Des galas d'Abidjan aux soirées de Grand-Bassam : confiez vos événements
              aux meilleurs talents du pays, ou décrochez les missions qui vous ressemblent.
            </p>
          </Reveal>

          <Reveal delay={1.3} y={18}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate('/onboarding')}
                className="btn-gold px-8 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center w-full sm:w-auto"
                style={{ color: '#261642', letterSpacing: '0.04em' }}>
                Je suis Freelance <IconArrow />
              </button>
              <button onClick={() => navigate('/pour-les-organisateurs')}
                className="px-8 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center transition-all hover:bg-white/10 w-full sm:w-auto cursor-pointer"
                style={{ background: 'var(--eb-l-glass-btn-bg)', border: '1.5px solid var(--eb-l-glass-btn-border)', color: 'var(--color-text-primary)', backdropFilter: 'blur(8px)', letterSpacing: '0.04em' }}>
                Je suis Organisateur
              </button>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => navigate('/feed')}
                className="text-sm font-medium inline-flex items-center gap-2"
                style={{ color: 'var(--color-text-secondary)', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold-light)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'}>
                Explorer le fil <IconArrow />
              </button>
            </div>
          </Reveal>
        </div>

        {/* Stats */}
        <div className="absolute bottom-0 left-0 right-0 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 rounded-t-2xl overflow-hidden"
              style={{ background: 'rgba(201,168,76,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(201,168,76,0.15)', borderBottom: 'none' }}>
              {[
                { value: '500+', label: 'Freelances actifs' },
                { value: '1 200+', label: 'Missions réalisées' },
                { value: '4.8', label: 'Note moyenne' },
                { value: '98%', label: 'Satisfaction client' },
              ].map((s, i) => (
                <Reveal key={s.label} delay={1.4 + i * 0.12} y={20} className="py-5 text-center"
                  style={{ borderRight: i < 3 ? '1px solid rgba(201,168,76,0.1)' : 'none' }}>
                  <div className="text-2xl font-bold text-gold-gradient">{s.value}</div>
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
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.15em' }}>
              Simple & Rapide
            </p>
            <h2 className="font-display text-4xl font-bold gold-rule" style={{ color: 'var(--color-text-primary)' }}>
              Trois étapes. Une équipe de rêve.
            </h2>
            <p className="mt-8 text-base" style={{ color: 'var(--color-text-muted)' }}>De votre idée à l'événement parfait, sans détour</p>
          </Reveal>

          <div className="landing-steps-gap grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            {/* Ligne connectrice desktop */}
            <div className="hidden md:block absolute top-[3.25rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px"
              style={{ background: 'linear-gradient(to right, rgba(201,168,76,0.5), rgba(201,168,76,0.15), rgba(201,168,76,0.5))' }} />

            {STEPS.map((s, idx) => (
              <Reveal key={s.n} delay={idx * 0.18} className="group flex flex-col items-center text-center">
                {/* Cercle icône */}
                <div className="relative mb-8">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
                    style={{ background: 'rgba(201,168,76,0.04)', border: '1.5px solid rgba(201,168,76,0.18)' }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,var(--color-card-bg),var(--eb-l-step-inner))', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {idx === 0 && <IconStepPost />}
                      {idx === 1 && <IconStepMatch />}
                      {idx === 2 && <IconStepDone />}
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,var(--color-gold-primary),var(--color-gold-light))', color: '#261642', boxShadow: '0 0 18px rgba(201,168,76,0.45)' }}>
                    {s.n}
                  </div>
                </div>

                {/* Texte */}
                <h3 className="font-display font-semibold text-2xl mb-4" style={{ color: 'var(--color-text-primary)', letterSpacing: '0.02em' }}>{s.title}</h3>
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
            <img src={IMG_FREE} alt="Freelance événementiel" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'var(--eb-l-plum-fade-r)' }} />
          </div>
          <Reveal className="landing-px flex flex-col justify-center px-10 py-12 md:py-16" y={0}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.15em' }}>
              Pour les Freelances
            </p>
            <h2 className="font-display text-4xl font-bold mb-8" style={{ color: 'var(--color-text-primary)' }}>
              Votre talent mérite une scène à sa hauteur
            </h2>
            <div className="space-y-4 mb-8">
              {FREELANCE_AVANTAGES.map((item, i) => (
                <Reveal key={item} delay={0.15 + i * 0.1} y={14}>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)' }}>
                      <IconCheck />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-8 py-3 rounded-xl font-bold self-start flex items-center gap-2 text-sm"
              style={{ color: '#261642' }}>
              Créer mon profil <IconArrow />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── POUR LES ORGANISATEURS ── */}
      <section style={{ background: 'var(--eb-l-sec-deep)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[520px]">
          <Reveal className="flex flex-col justify-center px-10 py-16 order-2 md:order-1" y={0}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.15em' }}>
              Pour les Organisateurs
            </p>
            <h2 className="font-display text-4xl font-bold mb-8" style={{ color: 'var(--color-text-primary)' }}>
              Composez l'équipe que votre événement mérite
            </h2>
            <div className="space-y-4 mb-8">
              {ORG_AVANTAGES.map((item, i) => (
                <Reveal key={item} delay={0.15 + i * 0.1} y={14}>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)' }}>
                      <IconCheck />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="btn-outline-gold px-8 py-3 rounded-xl font-bold self-start flex items-center gap-2 text-sm">
              Publier une mission <IconArrow />
            </button>
          </Reveal>
          <div className="relative overflow-hidden min-h-72 order-1 md:order-2">
            <img src={IMG_ORG} alt="Organisateur événementiel" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'var(--eb-l-deep-fade-l)' }} />
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-28 px-6" style={{ background: 'var(--eb-l-root)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.15em' }}>
              Nos Prestations
            </p>
            <h2 className="font-display text-4xl font-bold gold-rule" style={{ color: 'var(--color-text-primary)' }}>
              L'excellence, dans chaque métier
            </h2>
            <p className="mt-8 text-base" style={{ color: 'var(--color-text-muted)' }}>
              Du service en salle à la sécurité, chaque prestation est portée par des professionnels passionnés
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.12} y={26}>
                <div className="group relative overflow-hidden rounded-2xl cursor-pointer card-lift"
                  style={{ height: '200px', border: '1px solid rgba(201,168,76,0.08)' }}
                  onClick={() => navigate('/onboarding')}>
                  <img src={s.img} alt={s.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0"
                    style={{ background: 'var(--eb-l-img-bottom)' }} />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>{s.label}</p>
                    <p className="text-xs mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-gold-primary)' }}>
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
          <div className="absolute inset-0" style={{ background: 'rgba(100,5,5,0.87)' }} />
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,60,60,0.08) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center animate-sos"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}>
                <IconWarning />
              </div>
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: 'rgba(255,180,180,0.8)', letterSpacing: '0.15em' }}>
              Alerte Urgence
            </p>
            <h2 className="font-display text-4xl font-bold mb-4" style={{ color: '#fff' }}>S.O.S Brigade</h2>
            <p className="text-lg mb-3 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Un imprévu à une heure du grand soir ?
            </p>
            <p className="text-base mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              Déclenchez l'alerte : les freelances disponibles autour de votre événement
              sont prévenus en temps réel et confirmés en quelques minutes. Votre soirée est sauvée.
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-5 mb-10">
            {[
              { v: '< 10 min', l: 'Temps de réponse moyen' },
              { v: '10 km', l: 'Rayon de recherche' },
              { v: '24h / 7j', l: 'Disponibilité' },
            ].map((stat, i) => (
              <Reveal key={stat.l} delay={0.15 + i * 0.12} y={20}>
                <div className="text-center px-7 py-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div className="text-xl font-bold text-white">{stat.v}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4} y={16}>
            <button onClick={() => navigate('/onboarding')}
              className="px-10 py-4 rounded-xl font-bold text-sm tracking-wide cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ background: 'white', color: '#b91c1c', letterSpacing: '0.04em' }}>
              Déclencher une alerte S.O.S
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section id="temoignages" className="py-28 px-6" style={{ background: 'var(--eb-l-sec-a)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.15em' }}>
              Témoignages
            </p>
            <h2 className="font-display text-4xl font-bold gold-rule" style={{ color: 'var(--color-text-primary)' }}>
              La confiance se gagne, événement après événement
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.15}>
                <div className="p-7 rounded-2xl card-lift h-full"
                  style={{ background: 'var(--eb-l-card)', border: '1px solid var(--color-card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => <IconStar key={j} filled={j < t.rating} />)}
                  </div>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                    "{t.text}"
                  </p>
                  <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                    <img src={t.avatar} alt={t.name}
                      className="w-11 h-11 rounded-full object-cover"
                      style={{ border: '2px solid rgba(201,168,76,0.25)' }} />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{t.company}</p>
                    </div>
                    <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--color-gold-primary)', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {t.role}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'var(--eb-l-cta-veil)' }} />
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.05) 0%, transparent 65%)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <Reveal>
            <div className="flex justify-center mb-10">
              <LogoMark size={120} animated />
            </div>
            <h2 className="font-display text-4xl font-bold mb-4">
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
                className="btn-gold px-10 py-4 rounded-xl font-bold text-sm flex items-center gap-2 justify-center"
                style={{ color: '#261642', letterSpacing: '0.04em' }}>
                Commencer maintenant <IconArrow />
              </button>
              <button onClick={() => navigate('/pour-les-organisateurs')}
                className="btn-outline-gold px-10 py-4 rounded-xl font-bold text-sm">
                En savoir plus
              </button>
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
              <a key={link} href="#"
                className="text-xs tracking-wide transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--color-gold-primary)'; }}
                onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--color-text-muted)'; }}>
                {link}
              </a>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>© 2026 EventBridge · Côte d'Ivoire</p>
        </div>
      </footer>

    </div>
  );
}
