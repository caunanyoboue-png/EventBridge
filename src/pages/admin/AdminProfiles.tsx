import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { Star, ShieldCheck, FileText, Eye } from 'lucide-react';
import { type Profile, type UserStatus, type CertificationLevel } from '../../types';
import { getInitials } from '../../lib/utils';
import CertifiedBadge from '../../components/CertifiedBadge';
import { IcoUsers } from '../../components/icons/DoodleIcons';
import { roleColor } from '../../lib/roleTheme';
import toast from 'react-hot-toast';


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
  const navigate = useNavigate();

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

  async function setCertif(id: string, level: CertificationLevel) {
    const { data, error } = await supabase.from('profiles')
      .update({ certification_level: level, is_certified: level !== 'none' })
      .eq('id', id).select('id');
    if (error) { console.error('[setCertif]', error); toast.error(`Erreur : ${error.message}`); return; }
    if (!data || data.length === 0) {
      toast.error('Action bloquée (droit admin manquant). Exécute supabase_migration_admin_profiles_update.sql.');
      return;
    }
    toast.success(level === 'none' ? 'Certification retirée' : `Certifié (${level === 'blue' ? 'bleu / premium' : 'gris'})`);
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
    const patch: Record<string, unknown> = {
      kyc_status: decision,
      kyc_reviewed_at: new Date().toISOString(),
    };
    // Pièce d'identité validée → certification "grise" (l'admin peut passer en bleu ensuite).
    if (decision === 'verified') { patch.certification_level = 'grey'; patch.is_certified = true; }
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

  // Statut affiché = disponibilité réglée par le freelance ; suspendu/banni prime.
  function availability(p: Profile): { label: string; color: string } {
    if (p.status === 'suspended') return { label: 'Suspendu', color: '#ef4444' };
    if (p.status === 'banned') return { label: 'Banni', color: '#7f1d1d' };
    if (p.role === 'freelance') return p.is_available ? { label: 'Disponible', color: '#10b981' } : { label: 'Indisponible', color: '#7a6a7a' };
    return { label: 'Actif', color: '#10b981' };
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><IcoUsers size={26} color={roleColor('admin')} /> Gestion des profils</h1>

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
                      <CertifiedBadge level={p.certification_level} certified={p.is_certified} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                      {p.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {(() => { const a = availability(p); return (
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${a.color}20`, color: a.color }}>{a.label}</span>
                    ); })()}
                  </td>
                  <td className="py-3 px-4">
                    {p.role !== 'freelance' ? (
                      <span style={{ color: '#4a3a5a' }}>—</span>
                    ) : p.kyc_status === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>À valider</span>
                    ) : (p.certification_level && p.certification_level !== 'none') ? (
                      <CertifiedBadge level={p.certification_level} certified={p.is_certified} />
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(122,106,122,0.15)', color: '#7a6a7a' }}>Non certifié</span>
                    )}
                  </td>
                  <td className="py-3 px-4" style={{ color: '#d4af37' }}>
                    {p.avg_rating
                      ? <span className="inline-flex items-center gap-1.5"><Star size={13} fill="#d4af37" color="#d4af37" /> {p.avg_rating.toFixed(1)}</span>
                      : '–'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap">
                      {p.role !== 'admin' && (
                        <button onClick={() => navigate(`/public-profile?id=${p.id}`)}
                          className="px-2 py-1 rounded text-xs inline-flex items-center gap-1" style={{ background: 'rgba(201,168,76,0.12)', color: '#d4af37' }}>
                          <Eye size={12} /> Consulter
                        </button>
                      )}
                      {/* KYC : revue des pièces (recto / verso) */}
                      {p.role === 'freelance' && p.kyc_document_path && (
                        <button onClick={() => viewKyc(p.kyc_document_path)}
                          className="px-2 py-1 rounded text-xs inline-flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                          <FileText size={12} /> Recto
                        </button>
                      )}
                      {p.role === 'freelance' && p.kyc_document_back_path && (
                        <button onClick={() => viewKyc(p.kyc_document_back_path)}
                          className="px-2 py-1 rounded text-xs inline-flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                          <FileText size={12} /> Verso
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
                          {p.role === 'freelance' && (
                            <>
                              <button onClick={() => setCertif(p.id, 'grey')}
                                className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(156,163,175,0.18)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.4)' }}>
                                Certif. grise
                              </button>
                              <button onClick={() => setCertif(p.id, 'blue')}
                                className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)' }}>
                                Certif. bleue
                              </button>
                              {p.certification_level && p.certification_level !== 'none' && (
                                <button onClick={() => setCertif(p.id, 'none')}
                                  className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                                  Retirer
                                </button>
                              )}
                            </>
                          )}
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
