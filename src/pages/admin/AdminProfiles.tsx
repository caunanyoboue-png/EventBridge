import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { Users, Star, Check, ShieldCheck, FileText } from 'lucide-react';
import { type Profile, type UserStatus } from '../../types';
import { getInitials } from '../../lib/utils';
import toast from 'react-hot-toast';

const kycColor: Record<string, string> = { verified: '#00C896', pending: '#F59E0B', rejected: '#EF4444', unverified: '#7a6a7a' };
const kycLabel: Record<string, string> = { verified: 'Vérifié', pending: 'À valider', rejected: 'Rejeté', unverified: 'Non vérifié' };

function RejectModal({ name, onClose, onConfirm }: {
  name: string; onClose: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,10,30,0.85)', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="card-glass p-6 w-full max-w-md">
        <h3 className="font-semibold mb-1" style={{ color: '#f0e6d3' }}>Rejeter la pièce de {name}</h3>
        <p className="text-xs mb-4" style={{ color: '#b8a898' }}>Le motif sera envoyé au freelance pour qu'il corrige.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Motif du rejet (ex : pièce illisible, expirée, ne correspond pas au nom)"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3', resize: 'none' }} />
        <div className="flex gap-2">
          <button type="button" disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); await onConfirm(reason); setBusy(false); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#ef4444', color: '#fff' }}>
            {busy ? '…' : 'Rejeter'}
          </button>
          <button type="button" onClick={onClose} className="px-4 rounded-xl text-sm border"
            style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [kycOnly, setKycOnly] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Profile | null>(null);

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

  // Ouvrir la pièce d'identité (bucket privé → URL signée 1h)
  async function viewKyc(path?: string) {
    if (!path) { toast.error('Aucune pièce fournie par ce freelance'); return; }
    const { data, error } = await supabase.storage.from('kyc').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error('Pièce indisponible'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function reviewKyc(p: Profile, decision: 'verified' | 'rejected', reason?: string) {
    const patch: Record<string, unknown> = { kyc_status: decision, kyc_reviewed_at: new Date().toISOString() };
    if (decision === 'verified') patch.status = 'active';            // RG3 : vérifié = activé
    if (decision === 'rejected') patch.kyc_rejection_reason = reason?.trim() || null;
    const { error } = await supabase.from('profiles').update(patch).eq('id', p.id);
    if (error) { toast.error('Erreur lors de la décision'); return; }
    try {
      await supabase.from('notifications').insert({
        user_id: p.id, type: 'kyc',
        title: decision === 'verified' ? 'Identité vérifiée ✓' : 'Pièce d\'identité refusée',
        body: decision === 'verified'
          ? 'Votre identité a été validée. Vous pouvez désormais recevoir des missions.'
          : `Votre pièce a été refusée${reason ? ' : ' + reason.trim() : ''}. Merci d'en soumettre une nouvelle.`,
        data: {}, is_read: false,
      });
    } catch { /* notif non bloquante */ }
    toast.success(decision === 'verified' ? 'Freelance vérifié !' : 'Pièce rejetée');
    setRejectTarget(null);
    fetchProfiles();
  }

  const kycPending = profiles.filter(p => p.kyc_status === 'pending').length;

  const filtered = profiles.filter(p => {
    if (kycOnly && p.kyc_status !== 'pending') return false;
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase()) && !p.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && p.role !== filterRole) return false;
    return true;
  });

  const statusColor: Record<string, string> = { active: '#10b981', pending: '#f59e0b', suspended: '#ef4444', banned: '#7f1d1d' };
  const statusLabel: Record<string, string> = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu', banned: 'Banni' };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Users size={26} color="#d4af37" /> Gestion des profils</h1>

      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="freelance">Freelance</option>
          <option value="organisateur">Organisateur</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={() => setKycOnly(v => !v)}
          className="px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5"
          style={kycOnly
            ? { background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }
            : { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
          <ShieldCheck size={15} /> À valider ({kycPending})
        </button>
        <span className="text-sm my-auto" style={{ color: '#b8a898' }}>{filtered.length} profil(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : (
        <div className="card-glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(82,54,124,0.4)', color: '#7a6a7a' }}>
                <th className="text-left py-3 px-4">Utilisateur</th>
                <th className="text-left py-3 px-4">Rôle</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Vérif.</th>
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
                        style={{ background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }}>
                        {getInitials(p.full_name)}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: '#f0e6d3' }}>{p.full_name}</p>
                        <p className="text-xs" style={{ color: '#7a6a7a' }}>{p.email}</p>
                      </div>
                      {p.is_certified && <Check size={13} color="#d4af37" />}
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
                  <td className="py-3 px-4">
                    {p.role === 'freelance' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: `${kycColor[p.kyc_status || 'unverified']}20`, color: kycColor[p.kyc_status || 'unverified'] }}>
                        {kycLabel[p.kyc_status || 'unverified']}
                      </span>
                    ) : <span style={{ color: '#4a3a5a' }}>—</span>}
                  </td>
                  <td className="py-3 px-4" style={{ color: '#d4af37' }}>
                    {p.avg_rating
                      ? <span className="inline-flex items-center gap-1.5"><Star size={13} fill="#d4af37" color="#d4af37" /> {p.avg_rating.toFixed(1)}</span>
                      : '–'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap">
                      {/* KYC : revue de la pièce */}
                      {p.role === 'freelance' && (p.kyc_status === 'pending' || p.kyc_document_path) && (
                        <button onClick={() => viewKyc(p.kyc_document_path)}
                          className="px-2 py-1 rounded text-xs inline-flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                          <FileText size={12} /> Pièce
                        </button>
                      )}
                      {p.role === 'freelance' && p.kyc_status === 'pending' && (
                        <>
                          <button onClick={() => reviewKyc(p, 'verified')}
                            className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(0,200,150,0.15)', color: '#00C896' }}>
                            Valider
                          </button>
                          <button onClick={() => setRejectTarget(p)}
                            className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            Rejeter
                          </button>
                        </>
                      )}
                      {/* Compte (les administrateurs se gèrent dans Paramètres, pas ici) */}
                      {p.role !== 'admin' && (
                        <>
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
                            className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(201,168,76,0.15)', color: '#d4af37' }}>
                            {p.is_certified ? 'Décertifier' : 'Certifier'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <RejectModal name={rejectTarget.full_name}
          onClose={() => setRejectTarget(null)}
          onConfirm={reason => reviewKyc(rejectTarget, 'rejected', reason)} />
      )}
    </DashboardLayout>
  );
}
