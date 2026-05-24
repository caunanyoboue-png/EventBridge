import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { type Profile, type UserStatus } from '../../types';
import { getInitials } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: UserStatus) {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Statut mis à jour'); fetchProfiles(); }
  }

  async function certifier(id: string, val: boolean) {
    await supabase.from('profiles').update({ is_certified: val }).eq('id', id);
    toast.success(val ? 'Profil certifié !' : 'Certification retirée');
    fetchProfiles();
  }

  const filtered = profiles.filter(p => {
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase()) && !p.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && p.role !== filterRole) return false;
    return true;
  });

  const statusColor: Record<string, string> = { active: '#10b981', pending: '#f59e0b', suspended: '#ef4444', banned: '#7f1d1d' };
  const statusLabel: Record<string, string> = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu', banned: 'Banni' };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6" style={{ color: '#f0e6d3' }}>👥 Gestion des profils</h1>

      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3">
        <input className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'rgba(61,36,96,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(61,36,96,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="freelance">Freelance</option>
          <option value="organisateur">Organisateur</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-sm my-auto" style={{ color: '#b8a898' }}>{filtered.length} profil(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : (
        <div className="card-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(61,36,96,0.4)', color: '#7a6a7a' }}>
                <th className="text-left py-3 px-4">Utilisateur</th>
                <th className="text-left py-3 px-4">Rôle</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Note</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t" style={{ borderColor: 'rgba(201,168,76,0.08)' }}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e' }}>
                        {getInitials(p.full_name)}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: '#f0e6d3' }}>{p.full_name}</p>
                        <p className="text-xs" style={{ color: '#7a6a7a' }}>{p.email}</p>
                      </div>
                      {p.is_certified && <span className="text-xs" style={{ color: '#c9a84c' }}>✓</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                      {p.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: `${statusColor[p.status] || '#7a6a7a'}20`, color: statusColor[p.status] || '#7a6a7a' }}>
                      {statusLabel[p.status] || p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4" style={{ color: '#c9a84c' }}>
                    {p.avg_rating ? `⭐ ${p.avg_rating.toFixed(1)}` : '–'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {p.status !== 'active' && (
                        <button onClick={() => updateStatus(p.id, 'active')}
                          className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                          Activer
                        </button>
                      )}
                      {p.status === 'active' && (
                        <button onClick={() => updateStatus(p.id, 'suspended')}
                          className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                          Suspendre
                        </button>
                      )}
                      <button onClick={() => certifier(p.id, !p.is_certified)}
                        className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c' }}>
                        {p.is_certified ? 'Décertifier' : 'Certifier'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
