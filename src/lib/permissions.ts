import type { Approval, DailyReport, Profile, Project, Task } from "./types";

/**
 * Эрхийн дүрэм — UI-д юу харуулах/идэвхжүүлэхийг шийднэ.
 * Supabase дээр ижил дүрмийг RLS + trigger (supabase/schema.sql) давхар хамгаална.
 *
 * ZUCA-д хоёр эрх: Админ (бүх ажилтны ажил, явц, баг, санхүү, тохиргоо) ба Ажилтан.
 * Ажилтан зөвхөн өөрт оноогдсон, өөрийн үүсгэсэн болон эзэнгүй ажлыг харна.
 */
export const isAdmin = (me: Pick<Profile, "role"> | null | undefined) => !!me && me.role === "admin";

/** Админ баталсан эсэх. Demo-гийн хуучин өгөгдөлд талбар байхгүй бол батлагдсанд тооцно. */
export const isApproved = (p: Profile | null | undefined) => !!p && (p.access ?? "approved") === "approved";

export function canSeeTask(me: Profile | null | undefined, t: Pick<Task, "assignee_id" | "created_by">) {
  if (isAdmin(me)) return true;
  if (!t.assignee_id) return true;
  return !!me && (t.assignee_id === me.id || t.created_by === me.id);
}

/** Төсөл засах: админ, төслийн хариуцагч, үүсгэгч (RLS v7-тэй ижил) */
export function canEditProject(me: Profile | null | undefined, p: Pick<Project, "owner_id" | "created_by">) {
  if (isAdmin(me)) return true;
  return !!me && (p.owner_id === me.id || p.created_by === me.id);
}
export function canDeleteProject(me: Profile | null | undefined, p: Pick<Project, "created_by">) {
  return isAdmin(me) || (!!me && p.created_by === me.id);
}

/** Эрх өөрчлөх — зөвхөн админ */
export const canSetRole = (me: Profile | null | undefined) => isAdmin(me);

/** Ажилтны мэдээлэл засах: админ бүгдийг, ажилтан өөрийгөө. target = null бол шинээр нэмэх */
export function canEditProfile(me: Profile | null | undefined, target: Profile | null | undefined) {
  if (!me) return false;
  return isAdmin(me) || (!!target && target.id === me.id);
}

/** Хүсэлтийг батлах админ — хүсэгчээс өөр, идэвхтэй, батлагдсан эхний админ */
export function approverFor(requester: Profile, profiles: Profile[]): string | null {
  return profiles.find((p) => p.active && isAdmin(p) && isApproved(p) && p.id !== requester.id)?.id ?? null;
}

export function canDecide(me: Profile | null | undefined, a: Approval) {
  if (!me || a.status !== "pending" || a.requester_id === me.id) return false;
  return a.approver_id === me.id || isAdmin(me);
}

export function canSeeApproval(me: Profile | null | undefined, a: Approval) {
  if (!me) return false;
  return a.requester_id === me.id || a.approver_id === me.id || isAdmin(me);
}

export function canSeeDaily(me: Profile | null | undefined, r: DailyReport) {
  return !!me && (r.profile_id === me.id || isAdmin(me));
}

/** Хэнд агентаар өдрийн ажил илгээж болох вэ: өөртөө, админ бүгдэд */
export function canNotify(me: Profile | null | undefined, target: Profile) {
  return !!me && (me.id === target.id || isAdmin(me));
}

/**
 * Албан тушаалаар хариуцагч олно (жишээ нь /партнер/ → партнершипийн менежер).
 * Хэд таарвал нээлттэй ажил цөөтэйг нь сонгоно. Хэлтэсгүй ZUCA-д ажлыг чиглүүлэх гол арга.
 */
export function pickByJob(profiles: Profile[], re: RegExp, load?: Map<string, number>): Profile | null {
  const hits = profiles.filter((p) => p.active && isApproved(p) && p.job_title && re.test(p.job_title));
  if (!hits.length) return null;
  return hits.sort((a, b) => (load?.get(a.id) ?? 0) - (load?.get(b.id) ?? 0))[0];
}
