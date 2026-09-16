export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type CampStage = "lead" | "contacted" | "onboarding" | "active" | "inactive";
export type CampSeason = "summer" | "autumn" | "all_year";
export type CampOwnership = "state" | "local" | "private" | "labor" | "org";

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
  role: "admin" | "member";
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
  due_date: string | null; // YYYY-MM-DD
  /** Төлөвлөсөн сар "YYYY-MM" — Төлөвлөгөө хуудсанд харагдана */
  planned_month: string | null;
  tags: string[];
  completed_at: string | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Partial<Omit<Profile, "id" | "created_at" | "updated_at">> & { full_name: string };
export type TaskInput = Partial<Omit<Task, "id" | "created_at" | "updated_at">> & { title: string };
export type CampInput = Partial<Omit<Camp, "id" | "created_at" | "updated_at">> & { name: string };
