import { useEffect, useState } from 'react';
import { Users, Target, Scale, CheckCircle2, LayoutDashboard, type LucideIcon } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, missions: 0, disputes: 0 });
  const [recentMissions, setRecentMissions] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function fetchStats() {
      const [{ count: users }, { count: missions }, { count: disputes }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('missions').select('*', { count: 'exact', head: true }),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setStats({ users: users || 0, missions: missions || 0, disputes: disputes || 0 });

      const { data } = await supabase.from('missions').select('*').order('created_at', { ascending: false }).limit(5);
      setRecentMissions(data || []);
    }
    fetchStats();
  }, []);

  const kpis: { label: string; value: string | number; Icon: LucideIcon; color: string }[] = [
    { label: 'Utilisateurs', value: stats.users, Icon: Users, color: '#d4af37' },
    { label: 'Missions', value: stats.missions, Icon: Target, color: '#10b981' },
    { label: 'Litiges ouverts', value: stats.disputes, Icon: Scale, color: '#ef4444' },
    { label: 'Satisfaction', value: '98%', Icon: CheckCircle2, color: '#3b82f6' },
  ];

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-8 flex items-center gap-3" style={{ color: '#f0e6d3' }}>
        <LayoutDashboard size={26} color="#d4af37" /> Dashboard Admin
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="card-glass p-6">
            <div className="mb-3"><k.Icon size={28} color={k.color} /></div>
            <div className="text-3xl font-bold mb-1" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm" style={{ color: '#b8a898' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card-glass p-6">
        <h2 className="font-semibold mb-4" style={{ color: '#f0e6d3' }}>Missions récentes</h2>
        {recentMissions.length === 0 ? (
          <p className="text-center py-8" style={{ color: '#b8a898' }}>Aucune mission</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: '#7a6a7a' }}>
                  <th className="text-left py-2 pr-4">Titre</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentMissions.map((m: Record<string, unknown>) => (
                  <tr key={m.id as string} className="border-t" style={{ borderColor: 'rgba(201,168,76,0.08)' }}>
                    <td className="py-3 pr-4 font-medium" style={{ color: '#f0e6d3' }}>{m.title as string}</td>
                    <td className="py-3 pr-4" style={{ color: '#b8a898' }}>{m.service_type as string}</td>
                    <td className="py-3 pr-4" style={{ color: '#b8a898' }}>{m.event_date as string}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        {m.status as string}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
