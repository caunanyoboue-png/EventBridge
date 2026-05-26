import { supabase } from './supabase';

export async function getOrCreateConversation(myId: string, otherId: string): Promise<string> {
  const { data } = await supabase.from('conversations')
    .select('id')
    .or(`and(participant_1.eq.${myId},participant_2.eq.${otherId}),and(participant_1.eq.${otherId},participant_2.eq.${myId})`)
    .maybeSingle();
  if (data) return data.id;
  const [p1, p2] = myId < otherId ? [myId, otherId] : [otherId, myId];
  const { data: created, error } = await supabase.from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id').single();
  if (error) throw error;
  return created.id;
}
