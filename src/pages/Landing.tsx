import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

const LOGO = '/logo.png.jpeg';

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
    desc: 'Décrivez votre mission en quelques minutes : type de prestation, date, lieu et tarif souhaité.',
  },
  {
    n: '02',
    title: 'Matchez les talents',
    desc: 'Recevez instantanément les profils qualifiés qui correspondent exactement à vos critères.',
  },
  {
    n: '03',
    title: 'Mission accomplie',
    desc: 'Contrats, paiements sécurisés et évaluations automatisés. Tout est géré sur la plateforme.',
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
      <path d="M2 6l3 3 5-5" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
      <path d="M7 5h14l7 7v18H7V5Z" stroke="#c9a84c" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M21 5v7h7" stroke="#c9a84c" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M12 16h10M12 20h10M12 24h6" stroke="#c9a84c" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
function IconStepMatch() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="12" cy="12" r="5.5" stroke="#c9a84c" strokeWidth="1.8"/>
      <circle cx="24" cy="12" r="5.5" stroke="#c9a84c" strokeWidth="1.8"/>
      <path d="M3 30c0-5 4-9 9-9h10c5 0 9 4 9 9" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IconStepDone() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="17" r="13" stroke="#c9a84c" strokeWidth="1.8"/>
      <path d="M11 17.5l4.5 4.5 8-9" stroke="#c9a84c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill={filled ? '#c9a84c' : 'none'}>
      <path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L7 1Z"
        stroke="#c9a84c" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  );
}

const FREELANCE_AVANTAGES = [
  'Accédez à des centaines de missions événementielles chaque semaine',
  'Paiements sécurisés et garantis dès la validation de la mission',
  'Construisez votre réputation avec le système d\'évaluations',
  'Alerte S.O.S : soyez mobilisé en temps réel sur des missions urgentes',
];
const ORG_AVANTAGES = [
  'Trouvez des profils vérifiés et certifiés en quelques minutes',
  'Filtrez par compétence, disponibilité, ville et tarif',
  'Gérez vos équipes, contrats et paiements depuis un seul outil',
  'Mobilisation d\'urgence avec le S.O.S Brigade en moins de 10 min',
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile) navigate('/dashboard');
  }, [user, profile, navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#0a0416' }}>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{ background: 'rgba(8,3,18,0.9)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <img src={LOGO} className="h-12 w-auto" alt="EventBridge"
          onError={e => {
            const t = e.target as HTMLImageElement;
            t.style.display = 'none';
            const span = document.createElement('span');
            span.textContent = 'EventBridge';
            span.style.cssText = 'font-family:serif;font-weight:700;font-size:1.2rem;color:#c9a84c;letter-spacing:0.05em';
            t.parentNode?.insertBefore(span, t.nextSibling);
          }} />

        <div className="hidden md:flex items-center gap-10">
          {[['#comment','Comment ça marche'],['#services','Services'],['#temoignages','Témoignages']].map(([href, label]) => (
            <a key={href} href={href}
              className="text-xs font-semibold tracking-widest uppercase transition-colors hover:opacity-100"
              style={{ color: '#6a5a7a', letterSpacing: '0.1em' }}>
              {label}
            </a>
          ))}
        </div>

        <button onClick={() => navigate('/onboarding')}
          className="btn-gold px-6 py-2.5 rounded-lg text-sm font-bold"
          style={{ color: '#1a0a2e' }}>
          Connexion
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, rgba(8,3,18,0.9) 0%, rgba(20,8,40,0.82) 45%, rgba(8,3,18,0.92) 100%)' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-44">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', display: 'inline-block' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: '#c9a84c', letterSpacing: '0.1em' }}>
              LA 1ÈRE PLATEFORME DE RECRUTEMENT ÉVÉNEMENTIEL EN CÔTE D'IVOIRE
            </span>
          </div>

          <h1 className="font-display font-bold mb-6 leading-tight"
            style={{ fontSize: 'clamp(2.8rem, 6vw, 5.2rem)', color: '#f5ede0' }}>
            Le pont entre{' '}
            <span className="text-gold-gradient">talents</span>{' '}et<br />
            <span className="text-gold-gradient">opportunités</span>
          </h1>

          <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: '#a09080', lineHeight: 1.8 }}>
            Trouvez les meilleurs extras pour vos événements ou décrochez des missions
            qui correspondent à vos compétences. Rapidement, en toute confiance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-8 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center w-full sm:w-auto"
              style={{ color: '#1a0a2e', letterSpacing: '0.04em' }}>
              Je suis Freelance <IconArrow />
            </button>
            <button onClick={() => navigate('/pour-les-organisateurs')}
              className="px-8 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center transition-all hover:bg-white/10 w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.18)', color: '#f0e6d3', backdropFilter: 'blur(8px)', letterSpacing: '0.04em' }}>
              Je suis Organisateur
            </button>
          </div>
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
                <div key={s.label} className="py-5 text-center"
                  style={{ borderRight: i < 3 ? '1px solid rgba(201,168,76,0.1)' : 'none' }}>
                  <div className="text-2xl font-bold text-gold-gradient">{s.value}</div>
                  <div className="text-xs mt-1 font-medium tracking-wide" style={{ color: '#5a4a6a' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section id="comment" className="py-28 px-6" style={{ background: '#0f0520' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>
              Simple & Rapide
            </p>
            <h2 className="font-display text-4xl font-bold" style={{ color: '#f0e6d3' }}>Comment ça marche ?</h2>
            <p className="mt-3 text-base" style={{ color: '#5a4a6a' }}>En 3 étapes, votre mission est lancée</p>
          </div>

          <div className="landing-steps-gap grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            {/* Ligne connectrice desktop */}
            <div className="hidden md:block absolute top-[3.25rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px"
              style={{ background: 'linear-gradient(to right, rgba(201,168,76,0.5), rgba(201,168,76,0.15), rgba(201,168,76,0.5))' }} />

            {STEPS.map((s, idx) => (
              <div key={s.n} className="group flex flex-col items-center text-center">
                {/* Cercle icône */}
                <div className="relative mb-8">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
                    style={{ background: 'rgba(201,168,76,0.04)', border: '1.5px solid rgba(201,168,76,0.18)' }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,rgba(45,27,78,0.9),rgba(26,10,46,0.95))', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {idx === 0 && <IconStepPost />}
                      {idx === 1 && <IconStepMatch />}
                      {idx === 2 && <IconStepDone />}
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e', boxShadow: '0 0 18px rgba(201,168,76,0.45)' }}>
                    {s.n}
                  </div>
                </div>

                {/* Texte */}
                <h3 className="font-bold text-xl mb-4" style={{ color: '#f0e6d3', letterSpacing: '0.02em' }}>{s.title}</h3>
                <p className="text-sm leading-loose max-w-xs" style={{ color: '#6a5a7a' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POUR LES FREELANCES ── */}
      <section style={{ background: '#1a0a2e' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[520px]">
          <div className="relative overflow-hidden min-h-72">
            <img src={IMG_FREE} alt="Freelance événementiel" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 55%, #1a0a2e)' }} />
          </div>
          <div className="landing-px flex flex-col justify-center px-10 py-12 md:py-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>
              Pour les Freelances
            </p>
            <h2 className="font-display text-3xl font-bold mb-8" style={{ color: '#f0e6d3' }}>
              Boostez vos revenus avec des missions premium
            </h2>
            <div className="space-y-4 mb-8">
              {FREELANCE_AVANTAGES.map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)' }}>
                    <IconCheck />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#9a8a7a' }}>{item}</p>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-8 py-3 rounded-xl font-bold self-start flex items-center gap-2 text-sm"
              style={{ color: '#1a0a2e' }}>
              Créer mon profil <IconArrow />
            </button>
          </div>
        </div>
      </section>

      {/* ── POUR LES ORGANISATEURS ── */}
      <section style={{ background: '#120720' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[520px]">
          <div className="flex flex-col justify-center px-10 py-16 order-2 md:order-1">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>
              Pour les Organisateurs
            </p>
            <h2 className="font-display text-3xl font-bold mb-8" style={{ color: '#f0e6d3' }}>
              Les meilleurs talents pour vos événements
            </h2>
            <div className="space-y-4 mb-8">
              {ORG_AVANTAGES.map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)' }}>
                    <IconCheck />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#9a8a7a' }}>{item}</p>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/onboarding')}
              className="px-8 py-3 rounded-xl font-bold self-start flex items-center gap-2 text-sm transition-all hover:opacity-90"
              style={{ background: 'transparent', border: '1.5px solid rgba(201,168,76,0.4)', color: '#c9a84c' }}>
              Publier une mission <IconArrow />
            </button>
          </div>
          <div className="relative overflow-hidden min-h-72 order-1 md:order-2">
            <img src={IMG_ORG} alt="Organisateur événementiel" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent 55%, #120720)' }} />
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-28 px-6" style={{ background: '#0a0416' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>
              Nos Prestations
            </p>
            <h2 className="font-display text-4xl font-bold" style={{ color: '#f0e6d3' }}>Tous types de missions</h2>
            <p className="mt-3 text-base" style={{ color: '#5a4a6a' }}>Des talents pour chaque besoin événementiel</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {SERVICES.map(s => (
              <div key={s.label} className="group relative overflow-hidden rounded-2xl cursor-pointer"
                style={{ height: '200px', border: '1px solid rgba(201,168,76,0.08)' }}
                onClick={() => navigate('/onboarding')}>
                <img src={s.img} alt={s.label}
                  className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-110" />
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(8,3,18,0.94) 0%, rgba(8,3,18,0.35) 55%, rgba(8,3,18,0.1) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-sm font-semibold tracking-wide" style={{ color: '#f0e6d3' }}>{s.label}</p>
                  <p className="text-xs mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#c9a84c' }}>
                    Voir les talents <IconArrow />
                  </p>
                </div>
              </div>
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
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
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
            Un extra qui se désiste à la dernière minute ?
          </p>
          <p className="text-base mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
            Déclenchez une alerte d'urgence et mobilisez les freelances disponibles
            dans un rayon de 10 km en moins de 10 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-5 mb-10">
            {[
              { v: '< 10 min', l: 'Temps de réponse moyen' },
              { v: '10 km', l: 'Rayon de recherche' },
              { v: '24h / 7j', l: 'Disponibilité' },
            ].map(stat => (
              <div key={stat.l} className="text-center px-7 py-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <div className="text-xl font-bold text-white">{stat.v}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/onboarding')}
            className="px-10 py-4 rounded-xl font-bold text-sm tracking-wide"
            style={{ background: 'white', color: '#b91c1c', letterSpacing: '0.04em' }}>
            Déclencher une alerte S.O.S
          </button>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section id="temoignages" className="py-28 px-6" style={{ background: '#0f0520' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>
              Témoignages
            </p>
            <h2 className="font-display text-4xl font-bold" style={{ color: '#f0e6d3' }}>Ils nous font confiance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-7 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, i) => <IconStar key={i} filled={i < t.rating} />)}
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#9a8a7a', lineHeight: 1.8 }}>
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                  <img src={t.avatar} alt={t.name}
                    className="w-11 h-11 rounded-full object-cover"
                    style={{ border: '2px solid rgba(201,168,76,0.25)' }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>{t.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#4a3a5a' }}>{t.company}</p>
                  </div>
                  <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: 'rgba(201,168,76,0.08)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>
                    {t.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'rgba(8,3,18,0.92)' }} />
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.05) 0%, transparent 65%)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <img src={LOGO} className="h-20 w-auto mx-auto mb-10" alt="EventBridge"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h2 className="font-display text-4xl font-bold mb-4">
            <span className="text-gold-gradient">Rejoignez EventBridge</span><br />
            <span style={{ color: '#f0e6d3' }}>dès aujourd'hui</span>
          </h2>
          <p className="text-sm mb-10 leading-relaxed" style={{ color: '#5a4a6a', lineHeight: 1.9 }}>
            Gratuit pour les freelances. Simple pour les organisateurs.<br />
            Des milliers de missions vous attendent.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-10 py-4 rounded-xl font-bold text-sm flex items-center gap-2 justify-center"
              style={{ color: '#1a0a2e', letterSpacing: '0.04em' }}>
              Commencer maintenant <IconArrow />
            </button>
            <button onClick={() => navigate('/onboarding')}
              className="px-10 py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: 'transparent', border: '1.5px solid rgba(201,168,76,0.3)', color: '#c9a84c' }}>
              En savoir plus
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-8" style={{ background: '#040110', borderTop: '1px solid rgba(201,168,76,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <img src={LOGO} className="h-10 w-auto" alt="EventBridge"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="flex gap-8">
            {['À propos', 'Contact', 'CGU', 'Confidentialité'].map(link => (
              <a key={link} href="#"
                className="text-xs tracking-wide transition-opacity hover:opacity-70"
                style={{ color: '#3a2a4a' }}>
                {link}
              </a>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#2a1a3a' }}>© 2025 EventBridge · Côte d'Ivoire</p>
        </div>
      </footer>

    </div>
  );
}
