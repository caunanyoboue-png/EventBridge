import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Target, Scale, Wallet, LayoutDashboard, UserCheck, Briefcase,
  CheckCircle2, Star, ChevronRight, TrendingUp, type LucideIcon,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { formatCFA, formatDate } from '../../lib/utils';

interface Stats {
  users: number; freelances: number; organisateurs: number; freelancePending: number;
  missions: number; missionsOpen: number; missionsCompleted: number; disputesOpen: number;
  volume: number; commission: number; paid: number; toPay: number; payoutPending: number;
  avgRating: number | null;
}

const EMPTY: Stats = {
  users: 0, freelances: 0, organisateurs: 0, freelancePending: 0,
  missions: 0, missionsOpen: 0, missionsCompleted: 0, disputesOpen: 0,
  volume: 0, commission: 0, paid: 0, toPay: 0, payoutPending: 0, avgRating: null,
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [s, setS] = useState<Stats>(EMPTY);
  const [recent, setRecent] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    // Compteurs (parallèles, en HEAD pour ne pas charger les lignes)
    const counts = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelance'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'organisateur'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelance').eq('status', 'pending'),
      supabase.from('missions').select('*', { count: 'exact', head: true }),
      supabase.from('missions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('missions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    const [users, freelances, organisateurs, freelancePending, missions, missionsOpen, missionsCompleted, disputesOpen] =
      counts.map(r => r.count ?? 0);

    // Flux financiers : agrégation des paiements encaissés
    const { data: pays } = await supabase.from('payments')
      .select('amount, commission_amount, net_amount, payout_status').eq('status', 'completed');
    let volume = 0, commission = 0, paid = 0, toPay = 0, payoutPending = 0;
    for (const p of pays || []) {
      const amt = Number(p.amount) || 0;
      const comm = (p.commission_amount as number | null) ?? Math.round(amt * 0.10);
      const net = (p.net_amount as number | null) ?? (amt - comm);
      volume += amt; commission += comm;
      if (p.payout_status === 'paid') paid += net;
      else { toPay += net; payoutPending++; }
    }

    // Satisfaction = note moyenne de la plateforme
    const { data: revs } = await supabase.from('reviews').select('rating');
    const avgRating = revs && revs.length
      ? revs.reduce((a, r) => a + Number(r.rating), 0) / revs.length
      : null;

    const { data: rm } = await supabase.from('missions').select('*').order('created_at', { ascending: false }).limit(5);
    setRecent(rm || []);

    setS({
      users, freelances, organisateurs, freelancePending, missions, missionsOpen,
      missionsCompleted, disputesOpen, volume, commission, paid, toPay, payoutPending, avgRating,
    });
    setLoading(false);
  }

  // File d'attente admin : ce qui requiert une action
  const actions = [
    { label: 'Freelances à valider', count: s.freelancePending, color: '#F59E0B', Icon: UserCheck, path: '/admin/AdminProfiles' },
    { label: 'Litiges ouverts',      count: s.disputesOpen,     color: '#EF4444', Icon: Scale,    path: '/admin/AdminDisputes' },
    { label: 'Versements en attente', count: s.payoutPending,   color: '#d4af37', Icon: Wallet,   path: '/admin/AdminPayouts' },
  ];

  const kpis: { label: string; value: string | number; Icon: LucideIcon; color: string }[] = [
    { label: 'Utilisateurs',      value: s.users,            Icon: Users,        color: '#d4af37' },
    { label: 'Freelances',        value: s.freelances,       Icon: UserCheck,    color: '#00C896' },
    { label: 'Organisateurs',     value: s.organisateurs,    Icon: Briefcase,    color: '#3b82f6' },
    { label: 'Missions',          value: s.missions,         Icon: Target,       color: '#e8c97a' },
    { label: 'Missions actives',  value: s.missionsOpen,     Icon: TrendingUp,   color: '#00C896' },
    { label: 'Missions terminées', value: s.missionsCompleted, Icon: CheckCircle2, color: '#10b981' },
    { label: 'Litiges ouverts',   value: s.disputesOpen,     Icon: Scale,        color: '#EF4444' },
    { label: 'Note moyenne',      value: s.avgRating != null ? `${s.avgRating.toFixed(1)}/5` : '—', Icon: Star, color: '#F59E0B' },
  ];

  const flux = [
    { label: 'Volume des transactions', value: s.volume,     hint: 'encaissé via la plateforme' },
    { label: 'Commission encaissée',    value: s.commission, hint: '10 % par transaction' },
    { label: 'Reversé aux freelances',  value: s.paid,       hint: 'versements effectués' },
    { label: 'Reste à verser',          value: s.toPay,      hint: 'en attente de versement' },
  ];

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: '#f0e6d3' }}>
        <LayoutDashboard size={26} color="#d4af37" /> Supervision
      </h1>
      <p className="text-sm mb-7" style={{ color: '#b8a898' }}>Vue d'ensemble de la plateforme EventBridge.</p>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : (
        <>
          {/* Actions requises */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {actions.map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="card-glass p-4 flex items-center justify-between text-left transition"
                style={{ border: a.count > 0 ? `1px solid ${a.color}55` : '1px solid rgba(201,168,76,0.1)' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: `${a.color}1a` }}>
                    <a.Icon size={18} color={a.color} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: a.count > 0 ? a.color : '#f0e6d3' }}>{a.count}</div>
                    <div className="text-xs" style={{ color: '#b8a898' }}>{a.label}</div>
                  </div>
                </div>
                <ChevronRight size={18} color="#7a6a7a" />
              </button>
            ))}
          </div>

          {/* Flux financiers */}
          <div className="card-glass p-6 mb-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#f0e6d3' }}>
              <Wallet size={17} color="#d4af37" /> Flux financiers
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {flux.map(f => (
                <div key={f.label}>
                  <div className="text-xl font-bold" style={{ color: '#d4af37' }}>{formatCFA(f.value)}</div>
                  <div className="text-xs mt-1" style={{ color: '#f0e6d3' }}>{f.label}</div>
                  <div className="text-[11px]" style={{ color: '#7a6a7a' }}>{f.hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {kpis.map(k => (
              <div key={k.label} className="card-glass p-5">
                <div className="mb-2"><k.Icon size={24} color={k.color} /></div>
                <div className="text-2xl font-bold mb-0.5" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs" style={{ color: '#b8a898' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Missions récentes */}
          <div className="card-glass p-6">
            <h2 className="font-semibold mb-4" style={{ color: '#f0e6d3' }}>Missions récentes</h2>
            {recent.length === 0 ? (
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
                    {recent.map((m: Record<string, unknown>) => (
                      <tr key={m.id as string} className="border-t" style={{ borderColor: 'rgba(201,168,76,0.08)' }}>
                        <td className="py-3 pr-4 font-medium" style={{ color: '#f0e6d3' }}>{m.title as string}</td>
                        <td className="py-3 pr-4" style={{ color: '#b8a898' }}>{m.service_type as string}</td>
                        <td className="py-3 pr-4" style={{ color: '#b8a898' }}>{m.event_date ? formatDate(m.event_date as string) : '—'}</td>
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
        </>
      )}
    </DashboardLayout>
  );
}
