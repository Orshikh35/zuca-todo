import type { Approval, DailyReport, Department, Profile, Role, Task } from "./types";

/**
 * Эрхийн дүрэм — UI-д юу харуулах/идэвхжүүлэхийг шийднэ.
 * Supabase дээр ижил дүрмийг RLS + trigger (supabase/schema.sql, v4) давхар хамгаална.
 */
const RANK: Record<Role, number> = { admin: 3, director: 2, manager: 1, member: 0 };

export const atLeast = (me: Profile | null | undefined, role: Role) => !!me && RANK[me.role] >= RANK[role];

/** Байгууллагын бүтэц (хэлтэс, эрх) засах */
export const canManageOrg = (me: Profile | null | undefined) => atLeast(me, "director");

/** Хүний эрхийн түвшин өөрчлөх — зөвхөн админ, эсвэл удирдлага өөрөөсөө доош */
export function canSetRole(me: Profile | null | undefined, target: Role) {
  if (!me) return false;
  if (me.role === "admin") return true;
  return me.role === "director" && RANK[target] < RANK.director;
}

/** Тухайн хэлтсийг удирдах эрхтэй эсэх (дарга нь эсвэл удирдлага) */
export function canManageDept(me: Profile | null | undefined, dept: Department | null | undefined) {
  if (!me || !dept) return false;
  if (canManageOrg(me)) return true;
  return dept.head_id === me.id || (me.role === "manager" && me.department_id === dept.id);
}

/** Ажилтны мэдээлэл засах: өөрийгөө, эсвэл өөрийн хэлтсийн гишүүнийг (дарга), эсвэл бүгдийг (удирдлага) */
export function canEditProfile(me: Profile | null | undefined, target: Profile | null | undefined, depts: Department[]) {
  if (!me) return false;
  if (!target) return atLeast(me, "manager");
  if (me.id === target.id || canManageOrg(me)) return true;
  const dept = depts.find((d) => d.id === target.department_id);
  return canManageDept(me, dept);
}

/** Харах боломжтой хэлтсийн id-ууд. null = бүгдийг */
export function visibleDeptIds(me: Profile | null | undefined, depts: Department[]): Set<string> | null {
  if (!me) return new Set();
  if (canManageOrg(me)) return null;
  const ids = new Set<string>();
  for (const d of depts) if (canManageDept(me, d)) ids.add(d.id);
  if (me.department_id) ids.add(me.department_id);
  return ids;
}

/**
 * Хүсэлтийг хэн батлах вэ: хэлтсийн дарга → (дарга өөрөө бол) удирдлага → админ.
 * Хүн өөрийн хүсэлтийг өөрөө батлахгүй.
 */
export function approverFor(requester: Profile, depts: Department[], profiles: Profile[]): string | null {
  const dept = depts.find((d) => d.id === requester.department_id);
  if (dept?.head_id && dept.head_id !== requester.id) return dept.head_id;
  const pick = (role: Role) => profiles.find((p) => p.active && p.role === role && p.id !== requester.id)?.id;
  return pick("director") ?? pick("admin") ?? null;
}

export function canDecide(me: Profile | null | undefined, a: Approval) {
  if (!me || a.status !== "pending" || a.requester_id === me.id) return false;
  return a.approver_id === me.id || me.role === "admin" || (me.role === "director" && !a.approver_id);
}

export function canSeeApproval(me: Profile | null | undefined, a: Approval, depts: Department[]) {
  if (!me) return false;
  if (a.requester_id === me.id || a.approver_id === me.id || canManageOrg(me)) return true;
  return canManageDept(me, depts.find((d) => d.id === a.department_id));
}

export function canSeeDaily(me: Profile | null | undefined, r: DailyReport, profiles: Map<string, Profile>, depts: Department[]) {
  if (!me) return false;
  if (r.profile_id === me.id || canManageOrg(me)) return true;
  const author = profiles.get(r.profile_id);
  return canManageDept(me, depts.find((d) => d.id === author?.department_id));
}

/** Хэнд агентаар өдрийн ажил илгээж болох вэ */
export function canNotify(me: Profile | null | undefined, target: Profile, depts: Department[]) {
  if (!me) return false;
  if (me.id === target.id || canManageOrg(me)) return true;
  return canManageDept(me, depts.find((d) => d.id === target.department_id));
}

/** Ажлын хэлтсийг тодорхойлно: ажлын өөрийнх → хариуцагчийнх */
export function taskDeptId(t: Task, profileById: Map<string, Profile>) {
  return t.department_id ?? (t.assignee_id ? profileById.get(t.assignee_id)?.department_id ?? null : null);
}
