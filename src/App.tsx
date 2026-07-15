import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGateProvider, RETURN_KEY } from './contexts/AuthGateContext';
import { useEffect, type ReactNode } from 'react';

// Pages publiques
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import FreelancePage from './pages/FreelancePage';
import OrganisateurPage from './pages/OrganisateurPage';

// Pages authentifiées
import Dashboard from './pages/Dashboard';
import FreelanceDashboard from './pages/FreelanceDashboard';
import OrganisateurDashboard from './pages/OrganisateurDashboard';
import Missions from './pages/Missions';
import CreateMission from './pages/CreateMission';
import MissionDetail from './pages/MissionDetail';
import MyMissions from './pages/MyMissions';
import MyApplications from './pages/MyApplications';
import FreelanceProfiles from './pages/FreelanceProfiles';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import SosBrigade from './pages/SosBrigade';
import Settings from './pages/Settings';
import EditMission from './pages/EditMission';
import PublicProfile from './pages/PublicProfile';
import ContractDetail from './pages/ContractDetail';
import Feed from './pages/Feed';

// Pages admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfiles from './pages/admin/AdminProfiles';
import AdminMissions from './pages/admin/AdminMissions';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminReviews from './pages/admin/AdminReviews';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminSettings from './pages/admin/AdminSettings';
import Certification from './pages/Certification';

function ProtectedRoute({ children, role }: { children: ReactNode; role?: string }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#261642' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#d4af37', borderTopColor: 'transparent' }} />
          <p style={{ color: '#b8a898' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  // User connecté mais profil introuvable → onboarding pour créer le profil
  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0a1e' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #d4af37',
          borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Onboarding non terminé → forcer la complétion du profil
  if (profile.onboarding_done === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // Mauvais rôle pour cette route
  if (role && profile.role !== role && profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Route navigable connecté OU en invité (attend juste la résolution de la session).
function BrowseRoute({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#261642' }}>
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#d4af37', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const reduceMotion = useReducedMotion();

  // Après inscription/connexion depuis le mode invité → revenir là où on était
  useEffect(() => {
    if (profile && profile.onboarding_done !== false) {
      const rt = localStorage.getItem(RETURN_KEY);
      if (rt) {
        localStorage.removeItem(RETURN_KEY);
        if (rt !== window.location.pathname + window.location.search) navigate(rt);
      }
    }
  }, [profile, navigate]);
  // Sur mobile (Android en particulier), les couches composites de l'animation
  // plein écran provoquent des artefacts GPU au scroll → on simplifie.
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const lite = reduceMotion || isMobile;

  const content = (
    <Routes location={location}>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/pour-les-freelances" element={<FreelancePage />} />
      <Route path="/pour-les-organisateurs" element={<OrganisateurPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/feed" element={<BrowseRoute><Feed /></BrowseRoute>} />
      <Route path="/freelance-dashboard" element={<ProtectedRoute role="freelance"><FreelanceDashboard /></ProtectedRoute>} />
      <Route path="/organisateur-dashboard" element={<ProtectedRoute role="organisateur"><OrganisateurDashboard /></ProtectedRoute>} />
      <Route path="/missions" element={<BrowseRoute><Missions /></BrowseRoute>} />
      <Route path="/create-mission" element={<ProtectedRoute role="organisateur"><CreateMission /></ProtectedRoute>} />
      <Route path="/MissionDetail" element={<BrowseRoute><MissionDetail /></BrowseRoute>} />
      <Route path="/my-missions" element={<ProtectedRoute role="organisateur"><MyMissions /></ProtectedRoute>} />
      <Route path="/my-applications" element={<ProtectedRoute role="freelance"><MyApplications /></ProtectedRoute>} />
      <Route path="/freelances" element={<BrowseRoute><FreelanceProfiles /></BrowseRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/sos-brigade" element={<ProtectedRoute><SosBrigade /></ProtectedRoute>} />
      <Route path="/certification" element={<ProtectedRoute role="freelance"><Certification /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/edit-mission" element={<ProtectedRoute role="organisateur"><EditMission /></ProtectedRoute>} />
      <Route path="/public-profile" element={<BrowseRoute><PublicProfile /></BrowseRoute>} />
      <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />

      <Route path="/admin/AdminDashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/AdminProfiles" element={<ProtectedRoute role="admin"><AdminProfiles /></ProtectedRoute>} />
      <Route path="/admin/AdminMissions" element={<ProtectedRoute role="admin"><AdminMissions /></ProtectedRoute>} />
      <Route path="/admin/AdminDisputes" element={<ProtectedRoute role="admin"><AdminDisputes /></ProtectedRoute>} />
      <Route path="/admin/AdminReviews" element={<ProtectedRoute role="admin"><AdminReviews /></ProtectedRoute>} />
      <Route path="/admin/AdminPayouts" element={<ProtectedRoute role="admin"><AdminPayouts /></ProtectedRoute>} />
      <Route path="/admin/AdminSettings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  // Mobile / mouvement réduit : aucune enveloppe animée. Les couches composites
  // plein écran de framer-motion provoquent des artefacts GPU au scroll sur Android.
  if (lite) return content;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {/* Voile doré qui balaie l'écran à chaque navigation */}
        <motion.div
          initial={{ x: '-110%' }}
          animate={{ x: '110%' }}
          transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 32%, rgba(232,201,122,0.13) 46%, rgba(245,230,196,0.22) 50%, rgba(232,201,122,0.13) 54%, transparent 68%)',
          }}
        />
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGateProvider>
          <AppRoutes />
        </AuthGateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
