import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Conversation, type Message, type Profile } from '../types';
import { getInitials, formatRelative } from '../lib/utils';

export default function Messages() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (profile) fetchConversations(); }, [profile]);
  useEffect(() => { if (selected) fetchMessages(selected.id); }, [selected]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchConversations() {
    const { data } = await supabase.from('conversations')
      .select('*, participant_1_profile:profiles!participant_1(*), participant_2_profile:profiles!participant_2(*)')
      .or(`participant_1.eq.${profile!.id},participant_2.eq.${profile!.id}`)
      .order('last_message_at', { ascending: false });

    const convs = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      other_user: c.participant_1 === profile!.id ? c.participant_2_profile as Profile : c.participant_1_profile as Profile,
    })) as Conversation[];
    setConversations(convs);
    setLoading(false);
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

  async function sendMessage() {
    if (!text.trim() || !selected || !profile) return;
    const content = text.trim();
    setText('');
    await supabase.from('messages').insert({ conversation_id: selected.id, sender_id: profile.id, content });
    await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', selected.id);
    await fetchMessages(selected.id);
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6" style={{ color: '#f0e6d3' }}>💬 Messages</h1>

      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Liste conversations */}
        <div className="w-72 flex flex-col card-glass overflow-hidden shrink-0">
          <div className="p-4 border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center py-8 text-sm" style={{ color: '#b8a898' }}>Chargement...</p>
            ) : conversations.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: '#b8a898' }}>Aucune conversation</p>
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
                      style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e' }}>
                      {other ? getInitials(other.full_name) : '?'}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="font-medium text-sm truncate" style={{ color: '#f0e6d3' }}>{other?.full_name || 'Utilisateur'}</p>
                      <p className="text-xs truncate" style={{ color: '#b8a898' }}>{c.last_message || 'Nouvelle conversation'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 card-glass flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-3">💬</p>
                <p style={{ color: '#b8a898' }}>Sélectionnez une conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e' }}>
                  {selected.other_user ? getInitials((selected.other_user as Profile).full_name) : '?'}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#f0e6d3' }}>{(selected.other_user as Profile)?.full_name || 'Utilisateur'}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const isMe = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-xs lg:max-w-md">
                        <div className="px-4 py-2.5 rounded-2xl text-sm"
                          style={isMe
                            ? { background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e', borderBottomRightRadius: '4px' }
                            : { background: 'rgba(61,36,96,0.7)', color: '#f0e6d3', border: '1px solid rgba(201,168,76,0.1)', borderBottomLeftRadius: '4px' }
                          }>
                          {m.content}
                        </div>
                        <p className={`text-xs mt-1 ${isMe ? 'text-right' : 'text-left'}`} style={{ color: '#7a6a7a' }}>
                          {m.created_at ? formatRelative(m.created_at) : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t flex gap-3" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <input
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(61,36,96,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
                  placeholder="Tapez votre message..."
                  value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button onClick={sendMessage} disabled={!text.trim()}
                  className="btn-gold px-4 py-2.5 rounded-xl font-bold text-[#1a0a2e]">
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
