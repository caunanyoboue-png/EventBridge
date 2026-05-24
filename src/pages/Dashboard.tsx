import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'freelance')    navigate('/freelance-dashboard',    { replace: true });
    else if (profile.role === 'organisateur') navigate('/organisateur-dashboard', { replace: true });
    else if (profile.role === 'admin')   navigate('/admin/AdminDashboard',   { replace: true });
  }, [profile, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0a1e' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #c9a84c',
        borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
