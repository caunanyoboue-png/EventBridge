import { useNavigate } from 'react-router-dom';

const LOGO = '/logo.png.jpeg';

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="#c9a84c">
      <path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L7 1Z" strokeLinejoin="round"/>
    </svg>
  );
}
function IconWarning() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M20 5L37 34H3L20 5Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M20 17v8M20 28v2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

const AVANTAGES = [
  { title: 'Profils vérifiés', desc: 'Tous nos freelances sont vérifiés, notés et certifiés. Vous recrutez en toute confiance.' },
  { title: 'Matching intelligent', desc: 'Filtrez par compétence, ville, disponibilité et tarif. Trouvez le profil idéal en quelques minutes.' },
  { title: 'Gestion centralisée', desc: 'Contrats, paiements, évaluations — tout géré depuis un tableau de bord unique.' },
  { title: 'Réseau de 500+ talents', desc: 'Accédez instantanément au plus grand vivier de freelances événementiels de Côte d\'Ivoire.' },
  { title: 'Paiements sécurisés', desc: 'Transactions protégées et garanties. Payez uniquement après validation de la mission.' },
  { title: 'Support dédié', desc: 'Une équipe disponible pour vous accompagner sur chaque recrutement, de A à Z.' },
];

const STEPS = [
  { n: '01', title: 'Publiez votre mission', desc: 'Décrivez votre besoin en quelques minutes : type de prestation, date, lieu, nombre de postes et budget.' },
  { n: '02', title: 'Recevez les candidatures', desc: 'Les freelances qualifiés de votre zone postulent immédiatement. Consultez leurs profils et sélectionnez.' },
  { n: '03', title: 'Mission réussie', desc: 'Votre équipe est confirmée. Gérez tout depuis la plateforme et évaluez après la mission.' },
];

const TEMOIGNAGES = [
  {
    name: 'Adjoua Konan', company: 'Hôtel Tiama Abidjan', role: 'Organisatrice', rating: 5,
    text: 'EventBridge a révolutionné notre façon de recruter. En quelques clics, nous trouvons des extras de qualité pour nos galas et banquets.',
    avatar: 'https://images.pexels.com/photos/5999825/pexels-photo-5999825.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
  {
    name: 'Ibrahim Keïta', company: 'Club Med CI', role: 'Directeur Évènements', rating: 5,
    text: 'Le S.O.S Brigade est une révolution. En 10 minutes, 3 serveurs confirmés pour une soirée de dernière minute. Incroyable efficacité.',
    avatar: 'https://images.pexels.com/photos/8302396/pexels-photo-8302396.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
  {
    name: 'Mariam Coulibaly', company: 'EventPro CI', role: 'Coordinatrice', rating: 5,
    text: 'La qualité des profils est remarquable. Les freelances sont professionnels, ponctuels et bien présentés. Je recommande sans hésiter.',
    avatar: 'https://images.pexels.com/photos/7648239/pexels-photo-7648239.jpeg?auto=compress&cs=tinysrgb&w=150&q=80',
  },
];

const TYPES_EVENTS = [
  'Galas & Soirées de prestige', 'Conférences & Séminaires',
  'Mariages & Cérémonies', 'Lancements de produits',
  'Cocktails d\'entreprise', 'Festivals & Concerts',
  'Réceptions diplomatiques', 'Événements sportifs',
];

export default function OrganisateurPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#0a0416' }}>

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{ background: 'rgba(8,3,18,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <button onClick={() => navigate('/')} className="flex items-center gap-3">
          <img src={LOGO} className="h-10 w-auto" alt="EventBridge" />
        </button>
        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => navigate('/pour-les-freelances')}
            className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-100"
            style={{ color: '#6a5a7a', letterSpacing: '0.1em' }}>
            Je suis Freelance
          </button>
        </div>
        <button onClick={() => navigate('/onboarding')}
          className="btn-gold px-6 py-2.5 rounded-lg text-sm font-bold"
          style={{ color: '#261642' }}>
          Publier une mission
        </button>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/Les meilleurs talents pour vos événements.jpeg" alt="" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, rgba(8,3,18,0.95) 0%, rgba(20,8,40,0.85) 40%, rgba(8,3,18,0.97) 100%)' }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', display: 'inline-block' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: '#c9a84c', letterSpacing: '0.1em' }}>
              POUR LES ORGANISATEURS D'ÉVÉNEMENTS
            </span>
          </div>
          <h1 className="font-display font-bold mb-6 leading-tight"
            style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)', color: '#f5ede0' }}>
            Les meilleurs talents<br />
            pour vos <span className="text-gold-gradient">événements</span>
          </h1>
          <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: '#a09080', lineHeight: 1.8 }}>
            Recrutez des freelances vérifiés et certifiés en quelques minutes.
            Service en salle, sécurité, animation, hôtesses — tout est disponible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-10 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center"
              style={{ color: '#261642', letterSpacing: '0.04em' }}>
              Publier ma première mission <IconArrow />
            </button>
            <button onClick={() => navigate('/onboarding')}
              className="px-10 py-4 rounded-xl font-bold text-sm flex items-center gap-3 justify-center transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.18)', color: '#f0e6d3', backdropFilter: 'blur(8px)' }}>
              Voir les profils disponibles
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-20 max-w-lg mx-auto">
            {[
              { v: '500+', l: 'Talents disponibles' },
              { v: '< 10 min', l: 'Temps de réponse' },
              { v: '98%', l: 'Satisfaction client' },
            ].map(s => (
              <div key={s.l} className="text-center py-4 rounded-xl"
                style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <div className="text-xl font-bold text-gold-gradient">{s.v}</div>
                <div className="text-xs mt-1" style={{ color: '#5a4a6a' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AVANTAGES */}
      <section className="py-24 px-6" style={{ background: '#0f0520' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>Pourquoi EventBridge</p>
            <h2 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>Une plateforme pensée pour vous</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {AVANTAGES.map((a, i) => (
              <div key={i} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.08)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
                  <IconCheck />
                </div>
                <h3 className="font-bold text-sm mb-2" style={{ color: '#f0e6d3' }}>{a.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6a5a7a', lineHeight: 1.8 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="py-24 px-6" style={{ background: '#1c1132' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>Simple & Rapide</p>
            <h2 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>Recruter en 3 étapes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] h-px"
              style={{ background: 'linear-gradient(to right, rgba(201,168,76,0.5), rgba(201,168,76,0.15), rgba(201,168,76,0.5))' }} />
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(201,168,76,0.05)', border: '1.5px solid rgba(201,168,76,0.2)' }}>
                    <span className="font-display text-2xl font-bold text-gold-gradient">{String(idx + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full"
                    style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', boxShadow: '0 0 12px rgba(201,168,76,0.4)' }} />
                </div>
                <h3 className="font-bold text-base mb-3" style={{ color: '#f0e6d3' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6a5a7a', lineHeight: 1.9 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TYPES D'ÉVÉNEMENTS */}
      <section className="py-24 px-6" style={{ background: '#0a0416' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>Nos domaines</p>
          <h2 className="font-display text-3xl font-bold mb-12" style={{ color: '#f0e6d3' }}>Pour tous types d'événements</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {TYPES_EVENTS.map(t => (
              <span key={t} className="px-5 py-2.5 rounded-full text-sm font-medium"
                style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', color: '#c9a84c' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SOS BRIGADE */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/page d'accueil eventbridge.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'rgba(100,5,5,0.88)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <IconWarning />
            </div>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4"
            style={{ color: 'rgba(255,180,180,0.8)', letterSpacing: '0.15em' }}>Fonctionnalité exclusive</p>
          <h2 className="font-display text-4xl font-bold mb-4" style={{ color: '#fff' }}>S.O.S Brigade</h2>
          <p className="text-lg mb-3 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Un extra qui se désiste à la dernière minute ?
          </p>
          <p className="text-sm mb-10 max-w-lg mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
            Déclenchez une alerte d'urgence et mobilisez les freelances disponibles
            dans un rayon de 10 km en moins de 10 minutes.
          </p>
          <button onClick={() => navigate('/onboarding')}
            className="px-10 py-4 rounded-xl font-bold text-sm"
            style={{ background: 'white', color: '#b91c1c', letterSpacing: '0.04em' }}>
            Accéder au S.O.S Brigade
          </button>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="py-24 px-6" style={{ background: '#0f0520' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>Témoignages</p>
            <h2 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>Ils nous font confiance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TEMOIGNAGES.map(t => (
              <div key={t.name} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => <IconStar key={i} />)}
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: '#9a8a7a', lineHeight: 1.8 }}>"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover"
                    style={{ border: '2px solid rgba(201,168,76,0.2)' }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>{t.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#4a3a5a' }}>{t.company} · {t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-28 px-6 text-center" style={{ background: '#1c1132' }}>
        <div className="max-w-xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#c9a84c', letterSpacing: '0.15em' }}>Commencez aujourd'hui</p>
          <h2 className="font-display text-4xl font-bold mb-4" style={{ color: '#f0e6d3' }}>
            Prêt à recruter les<br />
            <span className="text-gold-gradient">meilleurs talents ?</span>
          </h2>
          <p className="text-sm mb-10" style={{ color: '#5a4a6a', lineHeight: 1.9 }}>
            Publiez votre première mission en moins de 5 minutes.<br />
            Sans abonnement. Payez uniquement ce que vous utilisez.
          </p>
          <button onClick={() => navigate('/onboarding')}
            className="btn-gold px-12 py-4 rounded-xl font-bold text-sm flex items-center gap-2 justify-center mx-auto"
            style={{ color: '#261642', letterSpacing: '0.04em' }}>
            Publier une mission <IconArrow />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-8 text-center" style={{ background: '#040110', borderTop: '1px solid rgba(201,168,76,0.07)' }}>
        <p className="text-xs" style={{ color: '#2a1a3a' }}>© 2025 EventBridge · Côte d'Ivoire</p>
      </footer>

    </div>
  );
}
