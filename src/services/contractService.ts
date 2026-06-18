import { supabase } from '../lib/supabase';
import { type Contract, type CddReason, type Mission, type Profile, type PaymentMethod } from '../types';

const SMIG_HOURLY = 355; // FCFA/h — Art. 32.1 Code du Travail ivoirien 2023

// ── Calculs légaux ────────────────────────────────────────────────────────────

export function calcTotalGross(hourlyRate: number, dailyHours: number, totalDays: number): number {
  return Math.round(hourlyRate * dailyHours * totalDays);
}

export function calcIndemnity(totalGross: number): number {
  return Math.round(totalGross * 0.03); // Art. 15.8 : 3% du brut total
}

export function calcDaysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function validateSmig(hourlyRate: number): { ok: boolean; warning: string | null } {
  if (hourlyRate < SMIG_HOURLY) {
    return { ok: false, warning: `⚠ Inférieur au SMIG (${SMIG_HOURLY} FCFA/h — Art. 32.1 Code du Travail)` };
  }
  return { ok: true, warning: null };
}

export function validateCddDuration(start: string, end: string): { ok: boolean; warning: string | null } {
  const days = calcDaysBetween(start, end);
  if (days > 730) {
    return { ok: false, warning: '⚠ Durée max CDD dépassée — 2 ans maximum (Art. 15.4 Code du Travail)' };
  }
  return { ok: true, warning: null };
}

// ── Textes juridiques standards ───────────────────────────────────────────────

export const LEGAL_CLAUSES = {
  early_termination:
    'Le présent contrat à durée déterminée ne pourra être rompu avant son terme qu\'en cas de force majeure, d\'accord commun des parties ou de faute lourde de l\'une des parties. Toute rupture intervenant en violation de ces dispositions ouvre droit, au profit de la partie lésée, à des dommages et intérêts correspondant aux salaires et avantages dont le salarié aurait bénéficié jusqu\'au terme du contrat. (Art. 15.9)',
  anti_harassment:
    'Aucune des parties ne pourra exercer, directement ou indirectement, de harcèlement moral ou sexuel envers l\'autre partie ou les tiers. Tout agissement constitutif de harcèlement, tel que défini à l\'article 5 du Code du Travail ivoirien, pourra entraîner la rupture immédiate du présent contrat aux torts exclusifs de la partie fautive. (Art. 5)',
  non_discrimination:
    'L\'Organisateur s\'engage à ne pratiquer aucune discrimination à l\'égard du Freelance en raison de son origine, de son sexe, de ses opinions, de son appartenance syndicale, de sa situation de famille ou de son état de santé, conformément à l\'article 4 du Code du Travail ivoirien. (Art. 4)',
  no_forced_labor:
    'Le travail forcé ou obligatoire est formellement interdit. Nul ne peut être astreint à fournir un travail sous la contrainte ou la menace. (Art. 3)',
  telework:
    'Le Freelance pourra effectuer tout ou partie de la prestation en télétravail, selon les modalités convenues entre les parties. Les conditions d\'exercice du télétravail sont régies par l\'Ordonnance n°2021-902 du 22 décembre 2021. (Art. 16.6)',
  confidentiality:
    'Le Freelance s\'engage à garder strictement confidentielle toute information dont il aura connaissance dans le cadre de la mission, qu\'elle soit technique, commerciale ou personnelle, pendant toute la durée du contrat et pendant une période de 2 ans après son terme.',
};

// ── Génération d'un contrat depuis une mission ────────────────────────────────

export function generateContractData(
  mission: Mission,
  organizer: Profile,
  freelance: Profile,
): Omit<Contract, 'id' | 'created_at' | 'updated_at'> {
  const startDate = mission.event_date;
  const endDate   = mission.event_date; // même jour par défaut pour une mission
  const dailyHours = Number(mission.duration_hours) || 8;
  const totalDays  = 1;
  const totalGross = calcTotalGross(mission.hourly_rate, dailyHours, totalDays);
  const indemnity  = calcIndemnity(totalGross);

  const { warning: smigWarning } = validateSmig(mission.hourly_rate);
  if (smigWarning) console.warn('[ContractService]', smigWarning);

  return {
    mission_id:    mission.id,
    organizer_id:  organizer.id,
    freelance_id:  freelance.id,
    organizer_name:    organizer.company_name || organizer.full_name,
    organizer_address: organizer.ville || '',
    organizer_rccm:    organizer.rccm  || '',
    freelance_name:    freelance.full_name,
    freelance_address: freelance.ville || '',
    freelance_cni:     '',
    job_title:         mission.title,
    job_description:   mission.description,
    location:          `${mission.location}${mission.ville ? ', ' + mission.ville : ''}`,
    start_date:        startDate,
    end_date:          endDate,
    cdd_reason:        'surcroi' as CddReason,
    hourly_rate:       mission.hourly_rate,
    daily_hours:       dailyHours,
    total_days:        totalDays,
    total_gross:       totalGross,
    end_of_contract_indemnity: indemnity,
    payment_method:    (mission.payment_method as PaymentMethod) || 'orange_money',
    trial_period_days: null,
    has_telework_clause: false,
    has_confidentiality_clause: false,
    status:            'draft',
    proposed_by:       'system',
    organizer_signed_at: null,
    freelance_signed_at: null,
    rejection_reason:  null,
    version:           1,
    previous_version_id: null,
    pdf_url:           null,
  };
}

// ── CRUD Supabase ─────────────────────────────────────────────────────────────

export async function createContract(
  data: Omit<Contract, 'id' | 'created_at' | 'updated_at'>,
): Promise<Contract> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .insert(data)
    .select('*, organizer:profiles!organizer_id(*), freelance:profiles!freelance_id(*), mission:missions!mission_id(*)')
    .single();
  if (error) throw error;
  return contract as Contract;
}

export async function fetchContract(contractId: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, organizer:profiles!organizer_id(*), freelance:profiles!freelance_id(*), mission:missions!mission_id(*)')
    .eq('id', contractId)
    .single();
  if (error) throw error;
  return data as Contract;
}

export async function fetchContractsByUser(userId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, organizer:profiles!organizer_id(*), freelance:profiles!freelance_id(*), mission:missions!mission_id(*)')
    .or(`organizer_id.eq.${userId},freelance_id.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Contract[];
}

export async function fetchContractByMission(missionId: string): Promise<Contract | null> {
  const { data } = await supabase
    .from('contracts')
    .select('*, organizer:profiles!organizer_id(*), freelance:profiles!freelance_id(*)')
    .eq('mission_id', missionId)
    .maybeSingle();
  return data as Contract | null;
}

export async function fetchNegotiationHistory(contractId: string) {
  const { data, error } = await supabase
    .from('contract_negotiations')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Notification helper ───────────────────────────────────────────────────────

const CONTRACT_NOTIF: Record<string, { title: string; body: string }> = {
  proposed:         { title: 'Nouveau contrat proposé',    body: 'Un contrat CDD vous a été soumis pour validation.' },
  counter_proposed: { title: 'Contre-proposition reçue',   body: 'L\'autre partie a soumis une contre-proposition.' },
  accepted:         { title: 'Contrat accepté !',           body: 'L\'autre partie a accepté les termes du contrat.' },
  rejected:         { title: 'Contrat refusé',              body: 'L\'autre partie a refusé le contrat.' },
  signed:           { title: 'Contrat signé',               body: 'L\'autre partie a apposé sa signature.' },
};

async function notifyOtherParty(
  contractId: string,
  actorId: string,
  action: keyof typeof CONTRACT_NOTIF,
): Promise<void> {
  try {
    const { data: c } = await supabase
      .from('contracts').select('organizer_id, freelance_id').eq('id', contractId).single();
    if (!c) return;
    const recipientId = actorId === c.organizer_id ? c.freelance_id : c.organizer_id;
    const { title, body } = CONTRACT_NOTIF[action];
    await supabase.from('notifications').insert({
      user_id: recipientId, type: 'contract_action', title, body,
      data: { contract_id: contractId, action }, is_read: false,
    });
  } catch { /* notification failure must never block the main action */ }
}

// ── Actions workflow ──────────────────────────────────────────────────────────

export async function proposeContract(
  contractId: string,
  actorRole: 'organizer' | 'freelance',
  actorId: string,
): Promise<void> {
  const newStatus = actorRole === 'organizer' ? 'proposed_by_organizer' : 'proposed_by_freelance';
  const { error } = await supabase
    .from('contracts')
    .update({ status: newStatus, proposed_by: actorRole })
    .eq('id', contractId);
  if (error) throw error;

  await supabase.from('contract_negotiations').insert({
    contract_id: contractId, version: 1,
    snapshot: {}, action: 'proposed', actor_id: actorId, actor_role: actorRole,
  });
  await notifyOtherParty(contractId, actorId, 'proposed');
}

export async function counterPropose(
  contractId: string,
  changes: Partial<Contract>,
  actorRole: 'organizer' | 'freelance',
  actorId: string,
  message?: string,
): Promise<void> {
  // Recalculer les totaux si les paramètres financiers changent
  const updates: Partial<Contract> = { ...changes, status: 'counter_proposed', proposed_by: actorRole };
  if (changes.hourly_rate !== undefined || changes.daily_hours !== undefined || changes.total_days !== undefined) {
    const current = await fetchContract(contractId);
    const hr = changes.hourly_rate  ?? current.hourly_rate;
    const dh = changes.daily_hours  ?? current.daily_hours;
    const td = changes.total_days   ?? current.total_days;
    updates.total_gross = calcTotalGross(hr, dh, td);
    updates.end_of_contract_indemnity = calcIndemnity(updates.total_gross);
  }

  const { error } = await supabase.from('contracts').update(updates).eq('id', contractId);
  if (error) throw error;

  await supabase.from('contract_negotiations').insert({
    contract_id: contractId, version: 1,
    snapshot: changes, action: 'counter_proposed', actor_id: actorId, actor_role: actorRole, message,
  });
  await notifyOtherParty(contractId, actorId, 'counter_proposed');
}

export async function acceptContract(
  contractId: string,
  actorRole: 'organizer' | 'freelance',
  actorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'accepted_by_both' })
    .eq('id', contractId);
  if (error) throw error;

  await supabase.from('contract_negotiations').insert({
    contract_id: contractId, version: 1,
    snapshot: {}, action: 'accepted', actor_id: actorId, actor_role: actorRole,
  });
  await notifyOtherParty(contractId, actorId, 'accepted');
}

export async function rejectContract(
  contractId: string,
  actorRole: 'organizer' | 'freelance',
  actorId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', contractId);
  if (error) throw error;

  await supabase.from('contract_negotiations').insert({
    contract_id: contractId, version: 1,
    snapshot: {}, action: 'rejected', actor_id: actorId, actor_role: actorRole, message: reason,
  });
  await notifyOtherParty(contractId, actorId, 'rejected');
}

export async function signContract(
  contractId: string,
  actorRole: 'organizer' | 'freelance',
  actorId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const field = actorRole === 'organizer' ? 'organizer_signed_at' : 'freelance_signed_at';

  const current = await fetchContract(contractId);
  const bothSigned =
    (actorRole === 'organizer' && current.freelance_signed_at) ||
    (actorRole === 'freelance' && current.organizer_signed_at);

  const updates: Partial<Contract> = { [field]: now };
  if (bothSigned) updates.status = 'signed';

  const { error } = await supabase.from('contracts').update(updates).eq('id', contractId);
  if (error) throw error;

  await supabase.from('contract_negotiations').insert({
    contract_id: contractId, version: current.version,
    snapshot: {}, action: 'signed', actor_id: actorId, actor_role: actorRole,
  });
  await notifyOtherParty(contractId, actorId, 'signed');
}

export async function updateContractPdfUrl(contractId: string, pdfPath: string): Promise<void> {
  // RPC SECURITY DEFINER : enregistre le chemin du PDF même si le contrat est
  // verrouillé (statut 'signed'), sans affaiblir la policy contracts_update.
  const { error } = await supabase.rpc('set_contract_pdf_url', {
    p_contract_id: contractId, p_pdf_path: pdfPath,
  });
  if (error) throw error;
}

export const CDD_REASON_LABELS: Record<string, string> = {
  surcroi:      'Surcroît occasionnel de travail',
  saisonnier:   'Emploi saisonnier',
  chantier:     'Chantier ou projet précis',
  remplacement: 'Remplacement d\'un salarié absent',
};
