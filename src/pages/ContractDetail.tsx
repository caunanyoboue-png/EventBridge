import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { fetchContract } from '../services/contractService';
import ContractNegotiationView from '../components/contracts/ContractNegotiationView';
import ContractTimeline from '../components/ContractTimeline';
import { type Contract } from '../types';
import toast from 'react-hot-toast';

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchContract(id)
      .then(c => setContract(c))
      .catch(() => toast.error('Contrat introuvable'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-20" style={{ color: '#b8a898' }}>Chargement du contrat...</div>
      </DashboardLayout>
    );
  }

  if (!contract || !profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-20" style={{ color: '#b8a898' }}>Contrat introuvable.</div>
      </DashboardLayout>
    );
  }

  const myRole: 'organizer' | 'freelance' =
    contract.organizer_id === profile.id ? 'organizer' : 'freelance';

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} style={{ color: '#b8a898' }}>← Retour</button>
          <h1 className="font-display text-xl font-bold" style={{ color: '#f0e6d3' }}>
            Contrat · {contract.job_title}
          </h1>
        </div>
        <ContractTimeline contract={contract} />
        <ContractNegotiationView
          contract={contract}
          myRole={myRole}
          myId={profile.id}
          onUpdate={setContract}
        />
      </div>
    </DashboardLayout>
  );
}
