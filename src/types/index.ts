export type UserRole = 'freelance' | 'organisateur' | 'admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type MissionStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type PaymentStatus = 'pending' | 'escrow' | 'released' | 'refunded' | 'failed';
export type CinetPayStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Payment {
  id: string;
  contract_id?: string;
  mission_id?: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  description?: string;
  transaction_id: string;
  cinetpay_token?: string;
  payment_url?: string;
  status: CinetPayStatus;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}
export type PaymentMethod = 'orange_money' | 'mtn_momo' | 'wave' | 'cash';
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type SosStatus = 'active' | 'fulfilled' | 'expired' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  bio?: string;
  ville?: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
  skills?: string[];
  experience_years?: number;
  hourly_rate?: number;
  avg_rating?: number;
  total_missions?: number;
  total_reviews?: number;
  is_certified?: boolean;
  is_available?: boolean;
  company_name?: string;
  company_sector?: string;
  rccm?: string;
  onboarding_done?: boolean;
  banner_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Mission {
  id: string;
  organisateur_id: string;
  title: string;
  description: string;
  service_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  hourly_rate: number;
  duration_hours: number;
  slots_total: number;
  slots_filled?: number;
  skills_required?: string[];
  dress_code?: string;
  is_urgent?: boolean;
  is_sos?: boolean;
  status?: MissionStatus;
  payment_method?: PaymentMethod;
  total_amount?: number;
  commission_rate?: number;
  venue_photo_url?: string;
  created_at?: string;
  updated_at?: string;
  organisateur?: Profile;
}

export interface Application {
  id: string;
  mission_id: string;
  freelance_id: string;
  status: ApplicationStatus;
  cover_message?: string;
  matching_score?: number;
  applied_at?: string;
  responded_at?: string;
  mission?: Mission;
  freelance?: Profile;
}

export interface Conversation {
  id: string;
  mission_id?: string;
  participant_1: string;
  participant_2: string;
  last_message?: string;
  last_message_at?: string;
  unread_count_1?: number;
  unread_count_2?: number;
  created_at?: string;
  other_user?: Profile;
  mission?: Mission;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: 'image' | 'file';
  is_read?: boolean;
  created_at?: string;
  sender?: Profile;
}

export interface Review {
  id: string;
  mission_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment?: string;
  type: 'org_to_free' | 'free_to_org';
  created_at?: string;
  reviewer?: Profile;
}

export interface SosSession {
  id: string;
  organisateur_id: string;
  mission_id?: string;
  service_type: string;
  location: string;
  slots_needed: number;
  slots_confirmed: number;
  radius_km: number;
  status: SosStatus;
  notified_count: number;
  expires_at: string;
  created_at?: string;
}

export interface PortfolioItem {
  id: string;
  freelance_id: string;
  image_url: string;
  title: string;
  description?: string;
  category: string;
  created_at?: string;
}

// ── Contrats ──────────────────────────────────────────────────────────────────
export type ContractStatus =
  | 'draft' | 'proposed_by_organizer' | 'proposed_by_freelance'
  | 'counter_proposed' | 'accepted_by_both' | 'rejected' | 'signed' | 'expired';

export type CddReason = 'surcroi' | 'saisonnier' | 'chantier' | 'remplacement';

export interface Contract {
  id: string;
  mission_id: string;
  organizer_id: string;
  freelance_id: string;
  organizer_name: string;
  organizer_address: string;
  organizer_rccm: string;
  freelance_name: string;
  freelance_address: string;
  freelance_cni: string;
  job_title: string;
  job_description: string;
  location: string;
  start_date: string;
  end_date: string;
  cdd_reason: CddReason;
  hourly_rate: number;
  daily_hours: number;
  total_days: number;
  total_gross: number;
  end_of_contract_indemnity: number;
  payment_method: PaymentMethod;
  trial_period_days: number | null;
  has_telework_clause: boolean;
  has_confidentiality_clause: boolean;
  status: ContractStatus;
  proposed_by: 'organizer' | 'freelance' | 'system';
  organizer_signed_at: string | null;
  freelance_signed_at: string | null;
  rejection_reason: string | null;
  version: number;
  previous_version_id: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  mission?: Mission;
  organizer?: Profile;
  freelance?: Profile;
}

export interface ContractNegotiationEntry {
  id: string;
  contract_id: string;
  version: number;
  snapshot: Contract;
  action: 'proposed' | 'counter_proposed' | 'accepted' | 'rejected' | 'signed';
  actor_id: string;
  actor_role: 'organizer' | 'freelance';
  message?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at?: string;
}
