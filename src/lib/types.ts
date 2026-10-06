export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type CampStage = "lead" | "contacted" | "onboarding" | "active" | "inactive";
export type CampSeason = "summer" | "autumn" | "all_year";
export type CampOwnership = "state" | "local" | "private" | "labor" | "org";

/**
 * Эрхийн түвшин:
 * admin — системийн бүх тохиргоо · director — удирдлага, бүх хэлтсийг харж батална ·
 * manager — өөрийн хэлтсийг удирдана · member — өөрийн ажил
 */
export type Role = "admin" | "director" | "manager" | "member";
export type ApprovalKind = "leave" | "purchase" | "expense" | "trip" | "general";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Ажилтан. Нэвтрэх эрхгүйгээр бүртгэгдэж, ажил хариуцаж болно. */
export interface Profile {
  id: string;
  /** auth.users.id — өөрөө бүртгүүлсэн бол холбогдоно, үгүй бол null */
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  color: string;
  role: Role;
  department_id: string | null;
  /** Telegram-аар өдрийн ажлаа авах chat id (bot-оор холбоно) */
  telegram_chat_id: string | null;
  notify_email: boolean;
  notify_telegram: boolean;
  /** Ажлаас гарсан хүнийг устгалгүй идэвхгүй болгоно */
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assignee_id: string | null;
  camp_id: string | null;
  /** Аль төсөлд хамаарах (v7) */
  project_id?: string | null;
  /** Ажлыг гүйцэтгэх хэлтэс */
  department_id: string | null;
  /** Өөр хэлтсээс ирсэн хүсэлт бол тэр хэлтэс */
  from_department_id: string | null;
  due_date: string | null; // YYYY-MM-DD
  /** Төлөвлөсөн сар "YYYY-MM" — Төлөвлөгөө хуудсанд харагдана */
  planned_month: string | null;
  tags: string[];
  completed_at: string | null;
  /** Хаанаас үүссэн: manual · chat · intake · auto (v5-аас өмнөх мөрөнд байхгүй) */
  source?: string | null;
  /** Чатын аль мессежээс AI үүсгэсэн */
  source_message_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Camp {
  id: string;
  name: string;
  stage: CampStage;
  season: CampSeason;
  aimag: string | null;
  soum: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  price_from: number | null;
  description: string | null;
  photos_count: number;
  has_contract: boolean;
  ownership: CampOwnership | null;
  register_no: string | null;
  founded_year: number | null;
  distance_km: number | null;
  notes: string | null;
  position: number;
  /** Зуслан хариуцагч ажилтан */
  owner_id: string | null;
  last_contacted_at: string | null;
  /** zuca.mn-ээс орой бүр шинэчлэгдэнэ (v6) */
  zuca_id?: number | null;
  zuca_slug?: string | null;
  zuca_rating?: number | null;
  zuca_reviews?: number | null;
  zuca_shifts_open?: number | null;
  zuca_synced_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** zuca.mn дээрх ээлж (синкээр шинэчлэгдэнэ) */
export interface ZucaShift {
  id: number;
  camp_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number;
  booked: number;
  price: number | null;
  is_open: boolean;
  is_day: boolean;
  synced_at: string;
}

/** Төсөл: олон ажлыг нэгтгэнэ. Явц % = дууссан ажил / нийт ажил (v7) */
export type ProjectStatus = "active" | "on_hold" | "done";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  /** Төслийн хариуцагч */
  owner_id: string | null;
  camp_id: string | null;
  start_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Хэлтэс / нэгж. parent_id-аар шатлал үүсгэнэ */
export interface Department {
  id: string;
  name: string;
  code: string | null;
  color: string;
  description: string | null;
  head_id: string | null;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Батлуулах хүсэлт: чөлөө, худалдан авалт, зардал, томилолт гэх мэт */
export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  description: string | null;
  amount: number | null;
  start_date: string | null;
  end_date: string | null;
  requester_id: string;
  department_id: string | null;
  approver_id: string | null;
  status: ApprovalStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Өдөр тутмын тайлан — хүн бүр өдөрт нэг */
export interface DailyReport {
  id: string;
  profile_id: string;
  date: string; // YYYY-MM-DD
  done: string;
  plan: string | null;
  blockers: string | null;
  hours: number | null;
  created_at: string;
  updated_at: string;
}

/** AI агентын илгээсэн мэдэгдлийн түүх */
export interface AgentRun {
  id: string;
  profile_id: string | null;
  kind: "digest" | "organize";
  channel: "email" | "telegram" | "preview";
  ok: boolean;
  detail: string | null;
  created_at: string;
}

/** Чатын суваг. ai_mode: auto — ажлыг шууд үүсгэнэ, suggest — санал болгоно, mention — зөвхөн @ai, off — унтраалттай */
export type AiMode = "auto" | "suggest" | "mention" | "off";

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: "team" | "inbox";
  department_id: string | null;
  ai_mode: AiMode;
  position: number;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** AI-ийн санал болгосон ажил (suggest горим) — хүн «Үүсгэх» дарж батална */
export interface TaskProposal {
  title: string;
  description: string;
  assignee_id: string;
  priority: TaskPriority;
  due_date: string;
  camp_id: string;
  department_id: string;
  project_id?: string;
  status?: "open" | "created" | "dismissed";
  task_id?: string;
}

export type MessageAuthorKind = "user" | "ai" | "system" | "external";

export interface Message {
  id: string;
  channel_id: string;
  /** user: бичсэн хүн · ai: AI-г дуудсан хүн · system/external: null */
  author_id: string | null;
  author_kind: MessageAuthorKind;
  /** Гадаад илгээгч (имэйл, zuca.mn гэх мэт) */
  author_name: string | null;
  body: string;
  reply_to: string | null;
  /** app · telegram · intake · cron */
  source: string;
  source_ref: string | null;
  /** Хүний мессежийг AI боловсруулсан төлөв */
  ai_state: "pending" | "done" | "skipped" | "error" | null;
  /** AI-ийн үүсгэсэн ажлууд */
  task_ids: string[];
  proposals: TaskProposal[] | null;
  created_at: string;
  edited_at: string | null;
}

export type ProfileInput = Partial<Omit<Profile, "id" | "created_at" | "updated_at">> & { full_name: string };
export type TaskInput = Partial<Omit<Task, "id" | "created_at" | "updated_at">> & { title: string };
export type CampInput = Partial<Omit<Camp, "id" | "created_at" | "updated_at">> & { name: string };
export type DepartmentInput = Partial<Omit<Department, "id" | "created_at" | "updated_at">> & { name: string };
export type ApprovalInput = Partial<Omit<Approval, "id" | "created_at" | "updated_at">> & { title: string; requester_id: string };
export type ProjectInput = Partial<Omit<Project, "id" | "created_at" | "updated_at">> & { name: string };
export type DailyReportInput = Partial<Omit<DailyReport, "id" | "created_at" | "updated_at">> & { profile_id: string; date: string; done: string };

/** Ерөнхий CRUD хийгддэг хүснэгтүүд */
export interface Rows {
  departments: Department;
  projects: Project;
  approvals: Approval;
  daily_reports: DailyReport;
  agent_runs: AgentRun;
}
export type TableName = keyof Rows;
