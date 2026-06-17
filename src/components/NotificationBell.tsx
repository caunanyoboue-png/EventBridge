import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, MessageCircle, Mail, CheckCircle2, XCircle, Siren, Wallet, FileText, Bell,
  Star, Flag,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { type Notification } from '../types';
import { formatRelative } from '../lib/utils';

const ICONS: Record<string, LucideIcon> = {
  mission_match:     Target,
  message:           MessageCircle,
  application:       Mail,
  accepted:          CheckCircle2,
  sos_alert:         Siren,
  sos_confirmed:     CheckCircle2,
  sos_rejected:      XCircle,
  payment_received:  Wallet,
  payment_confirmed: Wallet,
  contract:          FileText,
  mission_completed: CheckCircle2,
  review:            Star,
  dispute:           Flag,
  default:           Bell,
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!profile) return;
    fetchNotifs();

    const channel = supabase
      .channel(`notifs-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => {
        setNotifs(prev => [payload.new as Notification, ...prev].slice(0, 30));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // Fermer en cliquant dehors
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function fetchNotifs() {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', profile!.id)
      .order('created_at', { ascending: false }).limit(30);
    setNotifs(data || []);
  }

  function targetRoute(n: Notification): string | null {
    const d = (n.data || {}) as Record<string, string>;
    if (d.mission_id) return `/MissionDetail?id=${d.mission_id}`;
    if (d.contract_id) return `/contracts/${d.contract_id}`;
    if (d.sos_session_id) return '/sos-brigade';
    return null;
  }

  // Clic = marquer lu + déplier le message complet (toggle)
  async function handleNotifClick(n: Notification) {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    setExpandedId(prev => (prev === n.id ? null : n.id));
  }

  function goTo(n: Notification) {
    const r = targetRoute(n);
    if (r) { setOpen(false); setExpandedId(null); navigate(r); }
  }

  async function markAllRead() {
    await supabase.from('notifications')
      .update({ is_read: true }).eq('user_id', profile!.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>

      {/* Bouton cloche */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
          background: open ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.07)',
          border: '1px solid rgba(201,168,76,0.2)', transition: 'background 0.15s',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 18 20" fill="none">
          <path d="M9 2a6 6 0 0 0-6 6v3.5L1.5 14h15L15 11.5V8A6 6 0 0 0 9 2Z"
            stroke="#d4af37" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
          <path d="M7.5 17a1.5 1.5 0 0 0 3 0" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {unread > 0 && (
          <span className="notif-pulse" style={{
            position: 'absolute', top: -5, right: -5,
            minWidth: 18, height: 18, borderRadius: 999,
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #261642',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 320, maxWidth: 'calc(100vw - 24px)',
          background: '#16102e', border: '1px solid rgba(201,168,76,0.14)',
          borderRadius: 14, boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          zIndex: 200, overflow: 'hidden',
        }}>

          {/* En-tête */}
          <div style={{
            padding: '13px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(201,168,76,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>Notifications</span>
              {unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px',
                  borderRadius: 999, background: 'rgba(201,168,76,0.15)', color: '#d4af37' }}>
                  {unread} non lu{unread > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: '#d4af37', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 500,
              }}>
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <Bell size={28} color="rgba(240,230,211,0.4)" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 13, color: 'rgba(240,230,211,0.5)', margin: 0 }}>
                  Aucune notification pour l'instant
                </p>
              </div>
            ) : notifs.map((n, i) => (
              <button key={n.id} onClick={() => handleNotifClick(n)}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 16px',
                  borderBottom: i < notifs.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                  background: n.is_read ? 'transparent' : 'rgba(201,168,76,0.03)',
                  border: 'none', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.is_read ? 'transparent' : 'rgba(201,168,76,0.03)'}
              >
                {/* Icône type */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(201,168,76,0.1)',
                }}>
                  {(() => { const Icon = ICONS[n.type] || ICONS.default; return <Icon size={16} color="#d4af37" />; })()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 12, fontWeight: n.is_read ? 400 : 600, color: '#f0e6d3', margin: '0 0 2px',
                    ...(expandedId === n.id ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                  }}>
                    {n.title}
                  </p>
                  <p style={{
                    fontSize: 11, color: 'rgba(240,230,211,0.6)', margin: '0 0 4px',
                    ...(expandedId === n.id
                      ? { whiteSpace: 'pre-wrap', lineHeight: 1.5 }
                      : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                  }}>
                    {n.body}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(240,230,211,0.28)', margin: 0 }}>
                    {n.created_at ? formatRelative(n.created_at) : ''}
                  </p>
                  {expandedId === n.id && targetRoute(n) && (
                    <span role="button" tabIndex={0}
                      onClick={e => { e.stopPropagation(); goTo(n); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                        fontSize: 11, fontWeight: 600, color: '#d4af37', cursor: 'pointer' }}>
                      Voir →
                    </span>
                  )}
                </div>

                {/* Point non lu */}
                {!n.is_read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#d4af37', flexShrink: 0, marginTop: 5,
                  }} />
                )}
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
