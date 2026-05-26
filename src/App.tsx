import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { type ReactNode } from 'react';

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

// Pages admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfiles from './pages/admin/AdminProfiles';
import AdminMissions from './pages/admin/AdminMissions';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminReviews from './pages/admin/AdminReviews';
import AdminSettings from './pages/admin/AdminSettings';

function ProtectedRoute({ children, role }: { children: ReactNode; role?: string }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a0a2e' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
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
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #c9a84c',
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/pour-les-freelances" element={<FreelancePage />} />
      <Route path="/pour-les-organisateurs" element={<OrganisateurPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/freelance-dashboard" element={<ProtectedRoute role="freelance"><FreelanceDashboard /></ProtectedRoute>} />
      <Route path="/organisateur-dashboard" element={<ProtectedRoute role="organisateur"><OrganisateurDashboard /></ProtectedRoute>} />
      <Route path="/missions" element={<ProtectedRoute><Missions /></ProtectedRoute>} />
      <Route path="/create-mission" element={<ProtectedRoute role="organisateur"><CreateMission /></ProtectedRoute>} />
      <Route path="/MissionDetail" element={<ProtectedRoute><MissionDetail /></ProtectedRoute>} />
      <Route path="/my-missions" element={<ProtectedRoute role="organisateur"><MyMissions /></ProtectedRoute>} />
      <Route path="/my-applications" element={<ProtectedRoute role="freelance"><MyApplications /></ProtectedRoute>} />
      <Route path="/freelances" element={<ProtectedRoute><FreelanceProfiles /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/sos-brigade" element={<ProtectedRoute><SosBrigade /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/edit-mission" element={<ProtectedRoute role="organisateur"><EditMission /></ProtectedRoute>} />
      <Route path="/public-profile" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />

      <Route path="/admin/AdminDashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/AdminProfiles" element={<ProtectedRoute role="admin"><AdminProfiles /></ProtectedRoute>} />
      <Route path="/admin/AdminMissions" element={<ProtectedRoute role="admin"><AdminMissions /></ProtectedRoute>} />
      <Route path="/admin/AdminDisputes" element={<ProtectedRoute role="admin"><AdminDisputes /></ProtectedRoute>} />
      <Route path="/admin/AdminReviews" element={<ProtectedRoute role="admin"><AdminReviews /></ProtectedRoute>} />
      <Route path="/admin/AdminSettings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
