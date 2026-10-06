/**
 * Demo горим: Supabase тохируулаагүй үед browser-ийн localStorage дээр ажиллана.
 */
import { SEED_CAMPS, SEED_PEOPLE, SEED_TASKS } from "../seed-data";
import type { AgentRun, Approval, Camp, DailyReport, Department, Profile, ProfileInput, Project, Rows, TableName, Task } from "../types";
import { addDays, toISODate, uid } from "../utils";
import type { Repo } from "./repo";

const KEY = "zuca-ops-demo-v4";

interface DB {
  profiles: Profile[];
  tasks: Task[];
  camps: Camp[];
  departments: Department[];
  projects: Project[];
  approvals: Approval[];
  daily_reports: DailyReport[];
  agent_runs: AgentRun[];
  session: string | null;
}

const nowISO = () => new Date().toISOString();
const addMonthsKey = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const PALETTE = ["#4f46e5", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#7c3aed", "#ca8a04", "#0d9488"];

function blankProfile(input: ProfileInput): Profile {
  return {
    id: uid(),
    user_id: null,
    email: "",
    phone: null,
    job_title: null,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    role: "member",
    department_id: null,
    telegram_chat_id: null,
    notify_email: true,
    notify_telegram: true,
    active: true,
    note: null,
    created_at: nowISO(),
    updated_at: nowISO(),
    ...input,
  };
}
const daysAgo = (n: number) => addDays(new Date(), -n).toISOString();

/** Жишээ байгууллагын бүтэц. dept = SEED_DEPARTMENTS-ийн index */
const SEED_DEPARTMENTS = [
  { name: "Удирдлага", code: "EXEC", color: "#4f46e5", description: "Гүйцэтгэх удирдлага, стратеги" },
  { name: "Партнершип", code: "PART", color: "#0891b2", description: "Зуслангуудтай хамтын ажиллагаа, гэрээ" },
  { name: "Маркетинг", code: "MKT", color: "#ea580c", description: "Сурталчилгаа, сошиал, контент" },
  { name: "Санхүү", code: "FIN", color: "#16a34a", description: "Төлбөр, тооцоо, зардал" },
  { name: "Хүний нөөц", code: "HR", color: "#db2777", description: "Ажилтан, цалин, сургалт" },
];
const SEED_ORG: { job: string; dept: number; role: Profile["role"] }[] = [
  { job: "Үүсгэн байгуулагч, гүйцэтгэх захирал", dept: 0, role: "admin" },
  { job: "Партнершип менежер", dept: 1, role: "manager" },
  { job: "Маркетингийн менежер", dept: 2, role: "manager" },
  { job: "Контент бүтээгч", dept: 2, role: "member" },
];
const EXTRA_PEOPLE: (ProfileInput & { dept: number })[] = [
  { full_name: "Болд", email: "bold@zuca.mn", color: "#ca8a04", role: "manager", job_title: "Ерөнхий нягтлан", dept: 3 },
  { full_name: "Ану", email: "anu@zuca.mn", color: "#7c3aed", role: "manager", job_title: "Хүний нөөцийн менежер", dept: 4 },
  { full_name: "Мөнх", email: "munkh@zuca.mn", color: "#0d9488", role: "member", job_title: "Партнершип ажилтан", dept: 1 },
  { full_name: "Сарнай", email: "sarnai@zuca.mn", color: "#64748b", role: "director", job_title: "Үйл ажиллагаа хариуцсан захирал", dept: 0 },
];

export function buildSeed(): DB {
  const departments: Department[] = SEED_DEPARTMENTS.map((d, i) => ({
    id: uid(),
    head_id: null,
    parent_id: null,
    position: (i + 1) * 1000,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
    ...d,
  }));
  departments.slice(1).forEach((d) => (d.parent_id = departments[0].id));

  const profiles: Profile[] = [
    ...SEED_PEOPLE.map((p, i) => ({
      ...blankProfile(p),
      job_title: SEED_ORG[i]?.job ?? null,
      role: SEED_ORG[i]?.role ?? "member",
      department_id: departments[SEED_ORG[i]?.dept ?? 0].id,
      created_at: daysAgo(60),
      updated_at: daysAgo(60),
    })),
    ...EXTRA_PEOPLE.map(({ dept, ...p }) => ({
      ...blankProfile(p),
      department_id: departments[dept].id,
      created_at: daysAgo(50),
      updated_at: daysAgo(50),
    })),
  ];
  // Дарга нь тухайн хэлтсийн хамгийн өндөр эрхтэй хүн
  const rank = { admin: 3, director: 2, manager: 1, member: 0 };
  departments.forEach((d) => {
    const head = profiles.filter((p) => p.department_id === d.id).sort((a, b) => rank[b.role] - rank[a.role])[0];
    d.head_id = head?.id ?? null;
  });
  const campIds = new Map<string, string>();

  const camps: Camp[] = SEED_CAMPS.map((c, i) => {
    const id = uid();
    campIds.set(c.key, id);
    return {
      id,
      name: c.name,
      stage: c.stage,
      season: c.season,
      aimag: c.aimag,
      soum: c.soum ?? null,
      address: c.address ?? null,
      lat: null,
      lng: null,
      contact_person: c.contact_person ?? null,
      phone: c.phone ?? null,
      email: null,
      website: c.website ?? null,
      facebook: c.facebook ?? null,
      age_min: c.age_min ?? null,
      age_max: c.age_max ?? null,
      capacity: c.capacity ?? null,
      price_from: c.price_from ?? null,
      description: c.description ?? null,
      photos_count: c.photos_count ?? 0,
      has_contract: false,
      ownership: c.ownership ?? null,
      register_no: c.register_no ?? null,
      founded_year: c.founded_year ?? null,
      distance_km: c.distance_km ?? null,
      notes: c.notes ?? null,
      position: (i + 1) * 1000,
      owner_id: profiles[i % profiles.length].id,
      last_contacted_at: c.stage === "lead" ? null : daysAgo((i % 9) + 1),
      created_by: profiles[0].id,
      created_at: daysAgo(40 - i),
      updated_at: daysAgo(i % 7),
    };
  });

  const tasks: Task[] = SEED_TASKS.map((t, i) => {
    const created = daysAgo(t.createdDaysAgo ?? (i % 5) + 1);
    return {
      id: uid(),
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      position: (i + 1) * 1000,
      assignee_id: t.assignee == null ? null : profiles[t.assignee].id,
      camp_id: t.camp ? campIds.get(t.camp) ?? null : null,
      department_id: t.assignee == null ? null : profiles[t.assignee].department_id,
      from_department_id: null,
      due_date:
        t.planMonths != null
          ? null
          : t.dueOffset != null
          ? toISODate(addDays(new Date(), t.dueOffset))
          : t.completedDaysAgo != null
            ? toISODate(addDays(new Date(), -t.completedDaysAgo))
            : null,
      tags: t.tags ?? [],
      planned_month:
        t.planMonths != null
          ? addMonthsKey(t.planMonths)
          : t.completedDaysAgo != null
            ? daysAgo(t.completedDaysAgo).slice(0, 7)
            : t.dueOffset != null
              ? toISODate(addDays(new Date(), t.dueOffset)).slice(0, 7)
              : null,
      completed_at: t.completedDaysAgo != null ? daysAgo(t.completedDaysAgo) : null,
      created_by: profiles[0].id,
      created_at: created,
      updated_at: created,
    };
  });

  // Хэлтэс хоорондын ажил — өөр хэлтсээс ирсэн хүсэлт
  const [exec, part, mkt, fin, hr] = departments;
  const byEmail = (e: string) => profiles.find((p) => p.email === e)!;
  const cross: [string, Department, Department, Profile | null, Task["priority"], number][] = [
    ["Намрын аяны сурталчилгааны төсөв батлуулах", fin, mkt, byEmail("bold@zuca.mn"), "high", 2],
    ["Шинэ 5 зуслангийн гэрээний загвар хянах", exec, part, byEmail("sarnai@zuca.mn"), "medium", 4],
    ["Зуслангийн танилцуулга видеонд зураг авалт зохион байгуулах", mkt, part, byEmail("munkh@zuca.mn"), "medium", 6],
    ["Улирлын ажилтнуудын гэрээ бэлтгэх", hr, exec, byEmail("anu@zuca.mn"), "urgent", 1],
    ["9-р сарын борлуулалтын орлогын тайлан", fin, exec, byEmail("bold@zuca.mn"), "high", -1],
  ];
  cross.forEach(([title, to, from, who, priority, due], i) => {
    const d = toISODate(addDays(new Date(), due));
    tasks.push({
      id: uid(),
      title,
      description: `${from.name} хэлтсээс ирсэн хүсэлт`,
      status: i === 2 ? "in_progress" : "todo",
      priority,
      position: (tasks.length + 1) * 1000,
      assignee_id: who?.id ?? null,
      camp_id: null,
      department_id: to.id,
      from_department_id: from.id,
      due_date: d,
      planned_month: d.slice(0, 7),
      tags: ["хэлтэс хооронд"],
      completed_at: null,
      created_by: profiles[0].id,
      created_at: daysAgo(3),
      updated_at: daysAgo(1),
    });
  });

  const approval = (a: Partial<Approval> & Pick<Approval, "kind" | "title" | "requester_id">): Approval => {
    const req = profiles.find((p) => p.id === a.requester_id)!;
    return {
      id: uid(),
      description: null,
      amount: null,
      start_date: null,
      end_date: null,
      department_id: req.department_id,
      approver_id: departments.find((d) => d.id === req.department_id)?.head_id ?? profiles[0].id,
      status: "pending",
      decision_note: null,
      decided_at: null,
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
      ...a,
    };
  };
  const approvals: Approval[] = [
    approval({ kind: "leave", title: "Ээлжийн амралт", requester_id: byEmail("munkh@zuca.mn").id, start_date: toISODate(addDays(new Date(), 10)), end_date: toISODate(addDays(new Date(), 14)) }),
    approval({ kind: "purchase", title: "Зураг авалтын гэрэлтүүлгийн иж бүрдэл", requester_id: profiles[3].id, amount: 850000, description: "Зуслангийн видео бичлэгт" }),
    approval({ kind: "expense", title: "Хөвсгөл рүү зуслан шалгах томилолтын шатахуун", requester_id: profiles[1].id, amount: 320000, approver_id: profiles[0].id }),
    approval({ kind: "trip", title: "Тэрэлж — 3 зуслантай уулзах", requester_id: profiles[2].id, amount: 150000, status: "approved", decided_at: daysAgo(2), decision_note: "Зөвшөөрөв", start_date: toISODate(addDays(new Date(), -1)), end_date: toISODate(addDays(new Date(), 0)), created_at: daysAgo(4) }),
  ];

  const daily_reports: DailyReport[] = [];
  for (let back = 1; back <= 5; back++) {
    const date = toISODate(addDays(new Date(), -back));
    profiles.forEach((p, i) => {
      if ((i + back) % 4 === 0) return; // зарим нь тайлангаа өгөөгүй
      const mine = tasks.filter((t) => t.assignee_id === p.id);
      daily_reports.push({
        id: uid(),
        profile_id: p.id,
        date,
        done: mine.slice(0, 2).map((t) => `• ${t.title}`).join("\n") || "• Ажлын уулзалт, имэйл",
        plan: mine.slice(2, 3).map((t) => `• ${t.title}`).join("\n") || null,
        blockers: back === 1 && i === 1 ? "Зуслангийн эзэн утсаа авахгүй байна" : null,
        hours: 7 + ((i + back) % 3),
        created_at: addDays(new Date(), -back).toISOString(),
        updated_at: addDays(new Date(), -back).toISOString(),
      });
    });
  }

  const projects = seedProjects(profiles, tasks);

  return { profiles, tasks, camps, departments, projects, approvals, daily_reports, agent_runs: [], session: null };
}

/** Жишээ төсөл — зарим ажил нь дууссан тул явц % харагдана */
function seedProjects(profiles: Profile[], tasks: Task[]): Project[] {
  const owner = profiles[0];
  const project: Project = {
    id: uid(),
    name: "Зуслангийн 100 жилийн хаалт",
    description: "Хүүхдийн зуслангийн 100 жилийн ойн хаалтын арга хэмжээ",
    color: "#ea580c",
    status: "active",
    owner_id: owner?.id ?? null,
    camp_id: null,
    start_date: toISODate(addDays(new Date(), -14)),
    due_date: toISODate(addDays(new Date(), 21)),
    position: 1000,
    created_by: owner?.id ?? null,
    created_at: daysAgo(14),
    updated_at: daysAgo(1),
  };
  const items: [string, Task["status"], number, number | null][] = [
    ["Арга хэмжээний төсөв батлуулах", "done", -10, 0],
    ["Тайз, дуу хоолойн түрээс захиалах", "done", -4, 1],
    ["Урилга хэвлэж тараах", "in_progress", 3, 2],
    ["Ахмад зуслангийн багш нарын жагсаалт гаргах", "todo", 6, 1],
    ["Хүндэтгэлийн шагналын нэрс батлуулах", "review", 2, 0],
    ["Хэвлэл мэдээллийн урилга, пресс реализ", "todo", 10, 2],
    ["Фото, видео зураглаач захиалах", "todo", 14, 3],
  ];
  items.forEach(([title, status, due, who], i) => {
    const d = toISODate(addDays(new Date(), due));
    const p = who == null ? null : profiles[who % profiles.length];
    tasks.push({
      id: uid(),
      title,
      description: null,
      status,
      priority: i < 2 ? "high" : "medium",
      position: (tasks.length + 1) * 1000,
      assignee_id: p?.id ?? null,
      camp_id: null,
      project_id: project.id,
      department_id: p?.department_id ?? null,
      from_department_id: null,
      due_date: d,
      planned_month: d.slice(0, 7),
      tags: ["100 жил"],
      completed_at: status === "done" ? addDays(new Date(), due).toISOString() : null,
      created_by: owner?.id ?? null,
      created_at: daysAgo(14),
      updated_at: daysAgo(1),
    });
  });
  return [project];
}

/** Хуучин demo өгөгдлийг шинэ бүтцэд оруулна (хэлтэсгүй хувилбараас) */
function migrate(d: DB): DB {
  if (!d.departments) {
    const seed = buildSeed();
    d.departments = seed.departments;
    d.approvals = [];
    d.daily_reports = [];
  }
  d.agent_runs ??= [];
  // v7: төсөл нэмэгдсэн — хуучин demo-д жишээ төслийг нэмнэ
  if (!d.projects) d.projects = seedProjects(d.profiles, d.tasks);
  d.profiles.forEach((p) => {
    p.department_id ??= null;
    p.telegram_chat_id ??= null;
    p.notify_email ??= true;
    p.notify_telegram ??= true;
  });
  d.tasks.forEach((t) => {
    t.department_id ??= null;
    t.from_department_id ??= null;
  });
  return d;
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as DB);
  } catch {
    /* localStorage боломжгүй */
  }
  const db = buildSeed();
  save(db);
  return db;
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

let memo: DB | null = null;
const db = () => (memo ??= load());
const commit = () => save(db());
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

export function resetDemo() {
  memo = buildSeed();
  memo.session = null;
  save(memo);
}

export function createDemoRepo(): Repo {
  return {
    mode: "demo",

    async currentUser() {
      const d = db();
      if (!d.session) return null;
      return d.profiles.find((p) => p.id === d.session) ?? null;
    },
    async signIn(email) {
      const d = db();
      const p = d.profiles.find((x) => x.email === email.trim().toLowerCase()) ?? d.profiles[0];
      d.session = p.id;
      commit();
    },
    async signUp(email, _pw, fullName) {
      const d = db();
      const p = blankProfile({ full_name: fullName || email.split("@")[0], email, color: "#7c3aed" });
      d.profiles.push(p);
      d.session = p.id;
      commit();
      return { needsConfirm: false };
    },
    async signOut() {
      db().session = null;
      commit();
    },

    async listProfiles() {
      return delay(
        [...db().profiles].sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name, "mn")),
      );
    },
    async createProfile(input) {
      const p = blankProfile(input);
      db().profiles.push(p);
      commit();
      return delay({ ...p });
    },
    async updateProfile(id, patch) {
      const p = db().profiles.find((x) => x.id === id);
      if (!p) throw new Error("Ажилтан олдсонгүй");
      Object.assign(p, patch, { updated_at: nowISO() });
      commit();
      return delay({ ...p });
    },
    async deleteProfile(id) {
      const d = db();
      d.profiles = d.profiles.filter((x) => x.id !== id);
      // Хариуцагчийг нь салгана — ажил, зуслан үлдэнэ
      d.tasks.forEach((t) => {
        if (t.assignee_id === id) t.assignee_id = null;
      });
      d.camps.forEach((c) => {
        if (c.owner_id === id) c.owner_id = null;
      });
      d.departments.forEach((x) => {
        if (x.head_id === id) x.head_id = null;
      });
      if (d.session === id) d.session = null;
      commit();
    },

    async listTasks() {
      return delay([...db().tasks].sort((a, b) => a.position - b.position));
    },
    async createTask(input) {
      const t: Task = {
        id: uid(),
        description: null,
        status: "todo",
        priority: "medium",
        position: Date.now(),
        assignee_id: null,
        camp_id: null,
        department_id: null,
        from_department_id: null,
        due_date: null,
        planned_month: null,
        tags: [],
        completed_at: null,
        created_by: db().session,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...input,
      };
      if (t.status === "done" && !t.completed_at) t.completed_at = nowISO();
      db().tasks.push(t);
      commit();
      return delay({ ...t });
    },
    async updateTask(id, patch) {
      const t = db().tasks.find((x) => x.id === id);
      if (!t) throw new Error("Task олдсонгүй");
      const wasDone = t.status === "done";
      Object.assign(t, patch, { updated_at: nowISO() });
      if (t.status === "done" && !wasDone) t.completed_at = nowISO();
      if (t.status !== "done") t.completed_at = null;
      commit();
      return delay({ ...t });
    },
    async deleteTask(id) {
      const d = db();
      d.tasks = d.tasks.filter((x) => x.id !== id);
      commit();
    },

    async listCamps() {
      return delay([...db().camps].sort((a, b) => a.position - b.position));
    },
    async createCamp(input) {
      const c: Camp = {
        id: uid(),
        owner_id: null,
        stage: "lead",
        season: "summer",
        aimag: null,
        soum: null,
        address: null,
        lat: null,
        lng: null,
        contact_person: null,
        phone: null,
        email: null,
        website: null,
        facebook: null,
        age_min: null,
        age_max: null,
        capacity: null,
        price_from: null,
        description: null,
        photos_count: 0,
        has_contract: false,
        ownership: null,
        register_no: null,
        founded_year: null,
        distance_km: null,
        notes: null,
        position: Date.now(),
        last_contacted_at: null,
        created_by: db().session,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...input,
      };
      db().camps.push(c);
      commit();
      return delay({ ...c });
    },
    async updateCamp(id, patch) {
      const c = db().camps.find((x) => x.id === id);
      if (!c) throw new Error("Зуслан олдсонгүй");
      Object.assign(c, patch, { updated_at: nowISO() });
      commit();
      return delay({ ...c });
    },
    async deleteCamp(id) {
      const d = db();
      d.camps = d.camps.filter((x) => x.id !== id);
      d.tasks.forEach((t) => {
        if (t.camp_id === id) t.camp_id = null;
      });
      commit();
    },
    async importCamps(inputs) {
      const out: Camp[] = [];
      for (const i of inputs) out.push(await this.createCamp(i));
      return out;
    },

    async list<K extends TableName>(table: K) {
      const rows = db()[table] as Rows[K][];
      return delay(
        table === "departments" || table === "projects"
          ? [...rows].sort((a, b) => (a as Department | Project).position - (b as Department | Project).position)
          : [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
    },
    async insert<K extends TableName>(table: K, input: Partial<Rows[K]>) {
      const row = { id: uid(), created_at: nowISO(), updated_at: nowISO(), ...input } as Rows[K];
      (db()[table] as Rows[K][]).push(row);
      commit();
      return delay({ ...row });
    },
    async patch<K extends TableName>(table: K, id: string, patch: Partial<Rows[K]>) {
      const row = (db()[table] as Rows[K][]).find((x) => x.id === id);
      if (!row) throw new Error("Мөр олдсонгүй");
      Object.assign(row, patch, { updated_at: nowISO() });
      commit();
      return delay({ ...row });
    },
    async remove(table, id) {
      const d = db();
      const rows = d[table] as { id: string }[];
      const idx = rows.findIndex((x) => x.id === id);
      if (idx >= 0) rows.splice(idx, 1);
      if (table === "departments") {
        // Supabase-ийн "on delete set null"-тэй адил
        d.profiles.forEach((p) => p.department_id === id && (p.department_id = null));
        d.tasks.forEach((t) => {
          if (t.department_id === id) t.department_id = null;
          if (t.from_department_id === id) t.from_department_id = null;
        });
        d.departments.forEach((x) => x.parent_id === id && (x.parent_id = null));
        d.approvals.forEach((a) => a.department_id === id && (a.department_id = null));
      }
      if (table === "projects") d.tasks.forEach((t) => t.project_id === id && (t.project_id = null));
      commit();
    },

    async projectProgress() {
      const out: Record<string, { total: number; done: number }> = {};
      for (const t of db().tasks) {
        if (!t.project_id) continue;
        const c = (out[t.project_id] ??= { total: 0, done: 0 });
        c.total++;
        if (t.status === "done") c.done++;
      }
      return delay(out);
    },

    subscribe(onChange) {
      // Өөр tab дээрх өөрчлөлтийг сонсоно
      const handler = (e: StorageEvent) => {
        if (e.key === KEY) {
          memo = null;
          onChange();
        }
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
