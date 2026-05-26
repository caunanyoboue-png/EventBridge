import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FreelancePage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/onboarding', { replace: true }); }, [navigate]);
  return null;
}
