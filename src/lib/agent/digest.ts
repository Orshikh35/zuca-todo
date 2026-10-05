/**
 * Өдрийн ажлын товчоо (digest) — хүн бүрт "өнөөдөр юу хийх вэ"-г цэгцэлнэ.
 * Browser (урьдчилан харах) болон server (имэйл, Telegram, cron) хоёулаа ашиглана — цэвэр функц.
 */
import { PRIORITY_RANK } from "../constants";
import type { AgentPlan } from "./schema";
import type { Approval, DailyReport, Department, Profile, Task } from "../types";

export interface OrgSnapshot {
  profiles: Profile[];
  tasks: Task[];
  departments: Department[];
  approvals: Approval[];
  daily_reports: DailyReport[];
}

export const APP_TZ = "Asia/Ulaanbaatar";

/** Монголын цагаар өнөөдрийн огноо YYYY-MM-DD (server UTC дээр ажилладаг тул) */
export function todayIn(tz = APP_TZ, d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export function prettyDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}-р сарын ${d.getUTCDate()}, ${WEEKDAYS[d.getUTCDay()]}`;
}

const byUrgency = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

export interface DigestSection {
  key: string;
  title: string;
  tasks: Task[];
}

export interface TeamLine {
  dept: Department;
  open: number;
  overdue: number;
  dueToday: number;
  missingReports: Profile[];
  blockers: { who: Profile; text: string }[];
}

export interface Digest {
  person: Profile;
  date: string;
  sections: DigestSection[];
  total: number;
  /** Надаар батлуулахаар хүлээж буй хүсэлтүүд */
  approvalsToDecide: Approval[];
  /** Удирдах хэлтсүүдийн төлөв (дарга, удирдлагад) */
  team: TeamLine[];
  yesterdayReported: boolean;
  plan?: AgentPlan | null;
}

export function buildDigest(snap: OrgSnapshot, person: Profile, date = todayIn(), plan?: AgentPlan | null): Digest {
  const weekEnd = shiftDate(date, 7);
  const yesterday = shiftDate(date, -1);
  const open = snap.tasks.filter((t) => t.status !== "done" && t.assignee_id === person.id);
  const taken = new Set<string>();
  const take = (key: string, title: string, pred: (t: Task) => boolean): DigestSection => {
    const tasks = open.filter((t) => !taken.has(t.id) && pred(t)).sort(byUrgency);
    tasks.forEach((t) => taken.add(t.id));
    return { key, title, tasks };
  };

  const sections = [
    take("overdue", "Хугацаа хэтэрсэн", (t) => !!t.due_date && t.due_date < date),
    take("today", "Өнөөдөр дуусах", (t) => t.due_date === date),
    take("urgent", "Яаралтай", (t) => t.priority === "urgent"),
    take("progress", "Хийж буй", (t) => t.status === "in_progress" || t.status === "review"),
    take("week", "Энэ 7 хоногт", (t) => !!t.due_date && t.due_date <= weekEnd),
  ].filter((s) => s.tasks.length);

  const approvalsToDecide = snap.approvals.filter((a) => a.status === "pending" && a.approver_id === person.id);

  const managed = snap.departments.filter(
    (d) => d.head_id === person.id || person.role === "admin" || person.role === "director",
  );
  const team: TeamLine[] = managed
    .map((dept) => {
      const members = snap.profiles.filter((p) => p.active && p.department_id === dept.id);
      const deptTasks = snap.tasks.filter(
        (t) => t.status !== "done" && (t.department_id === dept.id || members.some((m) => m.id === t.assignee_id)),
      );
      const reports = snap.daily_reports.filter((r) => r.date === yesterday);
      return {
        dept,
        open: deptTasks.length,
        overdue: deptTasks.filter((t) => t.due_date && t.due_date < date).length,
        dueToday: deptTasks.filter((t) => t.due_date === date).length,
        missingReports: members.filter((m) => !reports.some((r) => r.profile_id === m.id)),
        blockers: reports
          .filter((r) => r.blockers && members.some((m) => m.id === r.profile_id))
          .map((r) => ({ who: members.find((m) => m.id === r.profile_id)!, text: r.blockers! })),
      };
    })
    .filter((l) => l.open || l.missingReports.length || l.blockers.length);

  return {
    person,
    date,
    sections,
    total: open.length,
    approvalsToDecide,
    team,
    yesterdayReported: snap.daily_reports.some((r) => r.profile_id === person.id && r.date === yesterday),
    plan,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function dueText(t: Task, date: string) {
  if (!t.due_date) return "";
  if (t.due_date === date) return "өнөөдөр";
  if (t.due_date < date) {
    const days = Math.round((Date.parse(date) - Date.parse(t.due_date)) / 86_400_000);
    return `${days} хоног хэтэрсэн`;
  }
  return t.due_date.slice(5).replace("-", "/");
}

const PRIO_MARK: Record<Task["priority"], string> = { urgent: "🔴", high: "🟠", medium: "🔵", low: "⚪" };

export function digestSubject(d: Digest) {
  const overdue = d.sections.find((s) => s.key === "overdue")?.tasks.length ?? 0;
  return `Өнөөдрийн ажил · ${prettyDate(d.date)}${overdue ? ` · ${overdue} хэтэрсэн` : ""}`;
}

/** Telegram (HTML parse_mode) — 4096 тэмдэгтээс хэтрэхгүй */
export function digestTelegram(d: Digest, appUrl?: string) {
  const L: string[] = [];
  L.push(`<b>☀️ ${esc(d.person.full_name)}, өнөөдрийн ажил</b>`);
  L.push(`<i>${prettyDate(d.date)}</i>`);
  if (d.plan?.summary) L.push("", `🤖 ${esc(d.plan.summary)}`);
  if (d.plan?.focus.length) {
    L.push("", "<b>🎯 Эхлээд хийх</b>");
    d.plan.focus.slice(0, 5).forEach((f, i) => L.push(`${i + 1}. ${esc(f.title)}${f.slot ? ` <i>(${esc(f.slot)})</i>` : ""}`));
  }
  if (!d.sections.length) L.push("", "✅ Танд хугацаатай нээлттэй ажил алга.");
  for (const s of d.sections) {
    L.push("", `<b>${esc(s.title)}</b> (${s.tasks.length})`);
    s.tasks.slice(0, 8).forEach((t) => {
      const due = dueText(t, d.date);
      L.push(`${PRIO_MARK[t.priority]} ${esc(t.title)}${due ? ` — <i>${due}</i>` : ""}`);
    });
    if (s.tasks.length > 8) L.push(`… бас ${s.tasks.length - 8}`);
  }
  if (d.approvalsToDecide.length) {
    L.push("", `<b>📝 Батлах хүсэлт</b> (${d.approvalsToDecide.length})`);
    d.approvalsToDecide.slice(0, 5).forEach((a) => L.push(`• ${esc(a.title)}`));
  }
  if (d.team.length) {
    L.push("", "<b>👥 Хэлтсийн байдал</b>");
    d.team.forEach((l) => {
      L.push(`<b>${esc(l.dept.name)}</b>: ${l.open} нээлттэй${l.overdue ? `, ⚠️ ${l.overdue} хэтэрсэн` : ""}${l.dueToday ? `, ${l.dueToday} өнөөдөр` : ""}`);
      if (l.missingReports.length) L.push(`   Өчигдрийн тайлангүй: ${esc(l.missingReports.map((p) => p.full_name).join(", "))}`);
      l.blockers.forEach((b) => L.push(`   🚧 ${esc(b.who.full_name)}: ${esc(b.text)}`));
    });
  }
  if (d.plan?.risks.length) {
    L.push("", "<b>⚠️ Анхаарах</b>");
    d.plan.risks.slice(0, 4).forEach((r) => L.push(`• ${esc(r)}`));
  }
  if (!d.yesterdayReported) L.push("", "✍️ Өчигдрийн тайлангаа бөглөөгүй байна.");
  if (appUrl) L.push("", `<a href="${appUrl}/tasks?who=${d.person.id}">Системд нээх →</a>`);
  const text = L.join("\n");
  return text.length > 4000 ? text.slice(0, 3990) + "\n…" : text;
}

/** Имэйлийн HTML (inline style — имэйл клиентүүд CSS class уншихгүй) */
export function digestHtml(d: Digest, appUrl?: string) {
  const row = (t: Task) => {
    const due = dueText(t, d.date);
    const color = { urgent: "#dc2626", high: "#ea580c", medium: "#0284c7", low: "#a1a1aa" }[t.priority];
    return `<tr><td style="padding:6px 0;border-bottom:1px solid #f4f4f5"><span style="display:inline-block;width:8px;height:8px;border-radius:9px;background:${color};margin-right:8px"></span>${esc(t.title)}</td><td style="padding:6px 0;border-bottom:1px solid #f4f4f5;text-align:right;color:${due.includes("хэтэрсэн") ? "#dc2626" : "#71717a"};font-size:12px;white-space:nowrap">${due}</td></tr>`;
  };
  const block = (title: string, inner: string) =>
    `<h3 style="margin:22px 0 6px;font-size:14px;color:#18181b">${title}</h3>${inner}`;

  let body = "";
  if (d.plan?.summary) body += `<p style="background:#eef2ff;border-radius:10px;padding:12px 14px;color:#3730a3;margin:16px 0 0">🤖 ${esc(d.plan.summary)}</p>`;
  if (d.plan?.focus.length)
    body += block(
      "🎯 Эхлээд хийх",
      `<ol style="margin:0;padding-left:20px">${d.plan.focus
        .map((f) => `<li style="margin:4px 0">${esc(f.title)}${f.slot ? ` <span style="color:#71717a">· ${esc(f.slot)}</span>` : ""}<br><span style="color:#71717a;font-size:12px">${esc(f.why)}</span></li>`)
        .join("")}</ol>`,
    );
  if (!d.sections.length) body += `<p style="color:#16a34a">✅ Танд хугацаатай нээлттэй ажил алга.</p>`;
  for (const s of d.sections)
    body += block(`${s.title} (${s.tasks.length})`, `<table style="width:100%;border-collapse:collapse;font-size:14px">${s.tasks.map(row).join("")}</table>`);
  if (d.approvalsToDecide.length)
    body += block(`📝 Таны батлах хүсэлт (${d.approvalsToDecide.length})`, `<ul style="margin:0;padding-left:20px">${d.approvalsToDecide.map((a) => `<li>${esc(a.title)}</li>`).join("")}</ul>`);
  if (d.team.length)
    body += block(
      "👥 Хэлтсийн байдал",
      d.team
        .map(
          (l) =>
            `<p style="margin:6px 0"><b>${esc(l.dept.name)}</b> — ${l.open} нээлттэй${l.overdue ? `, <span style="color:#dc2626">${l.overdue} хэтэрсэн</span>` : ""}${l.dueToday ? `, ${l.dueToday} өнөөдөр` : ""}${
              l.missingReports.length ? `<br><span style="color:#71717a;font-size:12px">Өчигдрийн тайлангүй: ${esc(l.missingReports.map((p) => p.full_name).join(", "))}</span>` : ""
            }${l.blockers.map((b) => `<br><span style="font-size:12px">🚧 ${esc(b.who.full_name)}: ${esc(b.text)}</span>`).join("")}</p>`,
        )
        .join(""),
    );
  if (d.plan?.risks.length) body += block("⚠️ Анхаарах", `<ul style="margin:0;padding-left:20px">${d.plan.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`);
  if (!d.yesterdayReported) body += `<p style="margin-top:20px;color:#b45309">✍️ Өчигдрийн тайлангаа бөглөөгүй байна.</p>`;

  const cta = appUrl
    ? `<p style="margin-top:24px"><a href="${appUrl}/tasks?who=${d.person.id}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px">Системд нээх</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#18181b"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:16px;padding:24px 24px 28px;border:1px solid #e4e4e7"><div style="color:#71717a;font-size:13px">${prettyDate(d.date)}</div><h2 style="margin:4px 0 0;font-size:20px">☀️ ${esc(d.person.full_name)}, өнөөдрийн ажил</h2>${body}${cta}</div><p style="text-align:center;color:#a1a1aa;font-size:11px;margin-top:14px">Энэ имэйлийг AI туслах автоматаар илгээв. Тохиргоогоо системийн «AI туслах» хэсгээс өөрчилнө.</p></div></body></html>`;
}

export function digestText(d: Digest, appUrl?: string) {
  return digestTelegram(d, appUrl).replace(/<[^>]+>/g, "");
}

/** AI-д өгөх товч өгөгдөл — токен хэмнэж, хувийн мэдээлэл (утас, имэйл) оруулахгүй */
export function planInput(snap: OrgSnapshot, person: Profile, date: string) {
  const dept = (id: string | null) => snap.departments.find((d) => d.id === id)?.name ?? null;
  const name = (id: string | null) => snap.profiles.find((p) => p.id === id)?.full_name ?? null;
  const mine = snap.tasks.filter((t) => t.status !== "done" && t.assignee_id === person.id);
  const lastReport = snap.daily_reports
    .filter((r) => r.profile_id === person.id && r.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    today: date,
    weekday: prettyDate(date),
    person: { name: person.full_name, job_title: person.job_title, role: person.role, department: dept(person.department_id) },
    tasks: mine.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description?.slice(0, 300) ?? null,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      department: dept(t.department_id),
      requested_by_department: dept(t.from_department_id),
      tags: t.tags,
      created_by: name(t.created_by),
    })),
    last_daily_report: lastReport ? { date: lastReport.date, done: lastReport.done, plan: lastReport.plan, blockers: lastReport.blockers } : null,
    approvals_waiting_for_me: snap.approvals.filter((a) => a.status === "pending" && a.approver_id === person.id).map((a) => ({ title: a.title, kind: a.kind, amount: a.amount })),
    colleagues: snap.profiles
      .filter((p) => p.active && p.id !== person.id && p.department_id === person.department_id)
      .map((p) => ({ id: p.id, name: p.full_name, job_title: p.job_title, open_tasks: snap.tasks.filter((t) => t.status !== "done" && t.assignee_id === p.id).length })),
  };
}
