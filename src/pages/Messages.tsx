import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Conversation, type Message, type Profile } from '../types';
import { getInitials, formatRelative } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Messages() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const targetConvId = urlParams.get('conv');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const [attachFile, setAttachFile]     = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const emojiRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { if (profile) fetchConversations(); }, [profile]);
  useEffect(() => { if (selected) fetchMessages(selected.id); }, [selected]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    if (showEmoji) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  // Real-time: new messages in the open conversation
  useEffect(() => {
    if (!selected?.id) return;
    const channel = supabase
      .channel(`conv-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, async payload => {
        const { data } = await supabase.from('messages')
          .select('*, sender:profiles!sender_id(*)')
          .eq('id', (payload.new as Message).id).single();
        if (data) {
          setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data as Message]);
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  async function fetchConversations() {
    const { data } = await supabase.from('conversations')
      .select('*, participant_1_profile:profiles!participant_1(*), participant_2_profile:profiles!participant_2(*)')
      .or(`participant_1.eq.${profile!.id},participant_2.eq.${profile!.id}`)
      .order('last_message_at', { ascending: false });

    const convs = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      other_user: c.participant_1 === profile!.id
        ? c.participant_2_profile as Profile
        : c.participant_1_profile as Profile,
    })) as Conversation[];

    setConversations(convs);
    setLoading(false);

    if (targetConvId) {
      const found = convs.find(c => c.id === targetConvId);
      if (found) {
        setSelected(found);
      } else {
        const { data: single } = await supabase.from('conversations')
          .select('*, participant_1_profile:profiles!participant_1(*), participant_2_profile:profiles!participant_2(*)')
          .eq('id', targetConvId).single();
        if (single && profile) {
          const enriched = {
            ...single,
            other_user: single.participant_1 === profile.id
              ? single.participant_2_profile as Profile
              : single.participant_1_profile as Profile,
          } as Conversation;
          setConversations(prev => [enriched, ...prev.filter(c => c.id !== enriched.id)]);
          setSelected(enriched);
        }
      }
    }
  }

  async function fetchMessages(convId: string) {
    const { data } = await supabase.from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    await supabase.from('messages').update({ is_read: true })
      .eq('conversation_id', convId).neq('sender_id', profile!.id);
  }

  function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Fichier trop lourd (max 20 Mo)'); return; }
    setAttachFile(file);
    if (file.type.startsWith('image/')) setAttachPreview(URL.createObjectURL(file));
    else setAttachPreview(null);
  }

  function clearAttach() {
    setAttachFile(null);
    setAttachPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function uploadAttachment(file: File): Promise<{ url: string; name: string; type: 'image' | 'file' }> {
    const ext  = file.name.split('.').pop();
    const path = `${profile!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    return { url: data.publicUrl, name: file.name, type: file.type.startsWith('image/') ? 'image' : 'file' };
  }

  async function sendMessage() {
    if ((!text.trim() && !attachFile) || !selected || !profile) return;
    setSending(true);
    const content = text.trim();
    setText('');
    setShowEmoji(false);

    let attachment: { url: string; name: string; type: 'image' | 'file' } | null = null;
    if (attachFile) {
      try { attachment = await uploadAttachment(attachFile); }
      catch { toast.error('Erreur lors de l\'envoi du fichier'); setSending(false); return; }
      clearAttach();
    }

    const { data: msg } = await supabase.from('messages')
      .insert({
        conversation_id: selected.id,
        sender_id: profile.id,
        content: content || (attachment ? attachment.name : ''),
        ...(attachment ? {
          attachment_url:  attachment.url,
          attachment_name: attachment.name,
          attachment_type: attachment.type,
        } : {}),
      })
      .select('*, sender:profiles!sender_id(*)')
      .single();

    if (msg) {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg as Message]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    const preview = content || (attachment ? `📎 ${attachment.name}` : '');
    await supabase.from('conversations')
      .update({ last_message: preview, last_message_at: new Date().toISOString() })
      .eq('id', selected.id);

    setSending(false);
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold mb-4" style={{ color: '#f0e6d3' }}>Messages</h1>

      <div className="msg-layout flex gap-4" style={{ height: 'calc(100vh - 12rem)' }}>

        {/* ── Liste conversations ── */}
        <div className={`msg-list w-72 flex flex-col card-glass overflow-hidden shrink-0${selected ? ' msg-list-hidden' : ''}`}>
          <div className="p-4 border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center py-8 text-sm" style={{ color: '#b8a898' }}>Chargement...</p>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-sm" style={{ color: '#b8a898' }}>Aucune conversation</p>
                <p className="text-xs mt-2" style={{ color: '#5a4a6a' }}>
                  Ouvrez le profil d'un utilisateur pour démarrer une conversation.
                </p>
              </div>
            ) : (
              conversations.map(c => {
                const other = c.other_user as Profile;
                const isSelected = selected?.id === c.id;
                return (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className="w-full p-4 flex items-center gap-3 text-left transition-all border-b"
                    style={{
                      background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent',
                      borderColor: 'rgba(201,168,76,0.05)',
                    }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }}>
                      {other ? getInitials(other.full_name) : '?'}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="font-medium text-sm truncate" style={{ color: '#f0e6d3' }}>
                        {other?.full_name || 'Utilisateur'}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#b8a898' }}>
                        {c.last_message || 'Nouvelle conversation'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Thread ── */}
        <div className={`flex-1 card-glass flex flex-col overflow-hidden${!selected ? ' msg-thread-hidden' : ''}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div style={{ width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(201,168,76,0.08)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 14px' }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M19 2H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h5l3 4 3-4h5a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"
                      stroke="#c9a84c" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ color: '#b8a898', fontSize: 14 }}>Sélectionnez une conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <button className="msg-back-btn" onClick={() => setSelected(null)}
                  style={{ display: 'none', alignItems: 'center', gap: 6,
                    background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                    color: '#c9a84c', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 2L4 7l5 5" stroke="#c9a84c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Retour
                </button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }}>
                  {selected.other_user ? getInitials((selected.other_user as Profile).full_name) : '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>
                    {(selected.other_user as Profile)?.full_name || 'Utilisateur'}
                  </p>
                </div>
                {(selected.other_user as Profile)?.id && (
                  <button
                    onClick={() => navigate(`/public-profile?id=${(selected.other_user as Profile).id}`)}
                    style={{ flexShrink: 0, fontSize: 12, fontWeight: 500,
                      padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid rgba(201,168,76,0.25)', color: '#c9a84c',
                      background: 'transparent' }}>
                    Voir profil
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const isMe = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-xs lg:max-w-md">
                        <div className="rounded-2xl text-sm overflow-hidden"
                          style={isMe
                            ? { background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642', borderBottomRightRadius: 4 }
                            : { background: 'rgba(82,54,124,0.7)', color: '#f0e6d3', border: '1px solid rgba(201,168,76,0.1)', borderBottomLeftRadius: 4 }
                          }>
                          {/* Pièce jointe image */}
                          {m.attachment_type === 'image' && m.attachment_url && (
                            <a href={m.attachment_url} target="_blank" rel="noreferrer">
                              <img src={m.attachment_url} alt={m.attachment_name || 'image'}
                                className="w-full max-w-xs object-cover"
                                style={{ display: 'block', borderRadius: 0 }} />
                            </a>
                          )}
                          {/* Pièce jointe fichier */}
                          {m.attachment_type === 'file' && m.attachment_url && (
                            <a href={m.attachment_url} target="_blank" rel="noreferrer" download={m.attachment_name}
                              className="flex items-center gap-2 px-4 py-3"
                              style={{ color: isMe ? '#261642' : '#c9a84c', textDecoration: 'none' }}>
                              <span className="text-lg">📎</span>
                              <span className="text-xs font-medium truncate max-w-[160px]">{m.attachment_name}</span>
                              <span className="text-xs shrink-0 opacity-70">↓</span>
                            </a>
                          )}
                          {/* Texte */}
                          {m.content && !(m.attachment_type === 'file' && !m.content.trim()) && (
                            <p className="px-4 py-2.5">{m.content}</p>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${isMe ? 'text-right' : 'text-left'}`}
                          style={{ color: '#7a6a7a' }}>
                          {m.created_at ? formatRelative(m.created_at) : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Prévisualisation pièce jointe */}
              {attachFile && (
                <div className="px-3 py-2 border-t flex items-center gap-3"
                  style={{ borderColor: 'rgba(201,168,76,0.1)', background: 'rgba(82,54,124,0.3)' }}>
                  {attachPreview ? (
                    <img src={attachPreview} alt="" className="h-14 w-14 object-cover rounded-lg" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg flex items-center justify-center text-2xl"
                      style={{ background: 'rgba(82,54,124,0.5)' }}>📎</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#f0e6d3' }}>{attachFile.name}</p>
                    <p className="text-xs" style={{ color: '#b8a898' }}>{(attachFile.size / 1024).toFixed(0)} Ko</p>
                  </div>
                  <button onClick={clearAttach}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    ✕
                  </button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmoji && (
                <div ref={emojiRef} style={{ position: 'absolute', bottom: 80, right: 16, zIndex: 100 }}>
                  <EmojiPicker
                    onEmojiClick={(data: EmojiClickData) => {
                      setText(prev => prev + data.emoji);
                      setShowEmoji(false);
                    }}
                    skinTonesDisabled
                    searchDisabled={false}
                    height={380}
                    width={300}
                  />
                </div>
              )}

              {/* Zone saisie */}
              <div className="p-3 border-t flex gap-2 items-end relative" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <input ref={fileRef} type="file" className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  onChange={handleAttachFile} />

                {/* Bouton emoji */}
                <button onClick={() => setShowEmoji(v => !v)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: showEmoji ? 'rgba(201,168,76,0.15)' : 'rgba(82,54,124,0.5)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    fontSize: 18,
                  }}
                  title="Emojis">
                  😊
                </button>

                {/* Bouton fichier */}
                <button onClick={() => fileRef.current?.click()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: attachFile ? 'rgba(201,168,76,0.15)' : 'rgba(82,54,124,0.5)',
                    border: `1px solid ${attachFile ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.2)'}`,
                    fontSize: 18,
                  }}
                  title="Joindre un fichier">
                  📎
                </button>

                <input
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
                  placeholder="Tapez votre message..."
                  value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />

                <button onClick={sendMessage} disabled={sending || (!text.trim() && !attachFile)}
                  className="btn-gold w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ opacity: (sending || (!text.trim() && !attachFile)) ? 0.5 : 1 }}>
                  {sending ? (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #261642',
                      borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 2L1 7l5 3 3 5 5-13Z" stroke="#261642" strokeWidth="1.6" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  );
}
