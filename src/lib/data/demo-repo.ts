/**
 * Demo горим: Supabase тохируулаагүй үед browser-ийн localStorage дээр ажиллана.
 */
import { SEED_CAMPS, SEED_PEOPLE, SEED_TASKS } from "../seed-data";
import type { AgentRun, Approval, Camp, DailyReport, Department, FinanceEntry, Idea, IdeaComment, IdeaSticker, IdeaStroke, Payroll, Profile, ProfileInput, Project, Rows, StoredFile, TableName, Task } from "../types";
import { addDays, toISODate, uid } from "../utils";
import type { Repo } from "./repo";

const KEY = "zuca-ops-demo-v4";

interface DB {
  profiles: Profile[];
  tasks: Task[];
  camps: Camp[];
  departments: Department[];
  projects: Project[];
  finance_entries: FinanceEntry[];
  payroll: Payroll[];
  files: StoredFile[];
  approvals: Approval[];
  daily_reports: DailyReport[];
  agent_runs: AgentRun[];
  ideas: Idea[];
  idea_comments: IdeaComment[];
  idea_stickers: IdeaSticker[];
  idea_strokes: IdeaStroke[];
  session: string | null;
}

const nowISO = () => new Date().toISOString();
/** Хуучин demo сэтгэгдлийн бөмбөлгийн байрлал (наалт дээр) */
const NOTE_PIN_X = 200;
const NOTE_PIN_Y = 150;
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

  const { finance_entries, payroll } = seedFinance(profiles, departments, projects);

  return { profiles, tasks, camps, departments, projects, finance_entries, payroll, files: [], approvals, daily_reports, agent_runs: [], ...seedIdeas(profiles), session: null };
}

/** Жишээ санхүү: сүүлийн 6 сарын цалин, зардал, орлого */
function seedFinance(profiles: Profile[], departments: Department[], projects: Project[]) {
  const finance_entries: FinanceEntry[] = [];
  const payroll: Payroll[] = [];
  const admin = profiles.find((p) => p.role === "admin") ?? profiles[0];
  const dept = (code: string) => departments.find((d) => d.code === code)?.id ?? null;
  const salaries = [3_500_000, 2_400_000, 2_200_000, 1_800_000, 2_600_000, 2_300_000, 1_900_000, 3_000_000];
  const at = (n: number, day: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    d.setDate(Math.min(day, 28));
    return toISODate(d);
  };
  for (let back = 5; back >= 0; back--) {
    const month = at(back, 1).slice(0, 7);
    profiles.forEach((p, i) => {
      if (!p.active) return;
      const base = salaries[i % salaries.length];
      const bonus = back === 1 && i % 3 === 0 ? 300_000 : 0;
      const si = Math.round((base + bonus) * 0.115);
      payroll.push({
        id: uid(),
        profile_id: p.id,
        month,
        base_salary: base,
        bonus,
        social_insurance: si,
        income_tax: Math.round((base + bonus - si) * 0.1),
        other_deductions: 0,
        employer_insurance: Math.round((base + bonus) * 0.125),
        paid: back > 0,
        paid_at: back > 0 ? at(back, 28) : null,
        note: null,
        created_by: admin?.id ?? null,
        created_at: at(back, 25),
        updated_at: at(back, 25),
      });
    });
    const add = (kind: FinanceEntry["kind"], category: string, title: string, amount: number, day: number, extra: Partial<FinanceEntry> = {}) =>
      finance_entries.push({
        id: uid(),
        kind,
        category,
        title,
        amount,
        date: at(back, day),
        vendor: null,
        description: null,
        department_id: null,
        project_id: null,
        profile_id: null,
        approval_id: null,
        created_by: admin?.id ?? null,
        created_at: at(back, day),
        updated_at: at(back, day),
        ...extra,
      });
    add("expense", "rent", "Оффисын түрээс", 2_800_000, 5, { vendor: "Central Tower" });
    add("expense", "software", "Сервер, домэйн", 420_000 + back * 10_000, 8, { department_id: dept("EXEC") });
    add("expense", "marketing", "Facebook сурталчилгаа", 900_000 + (5 - back) * 150_000, 12, { department_id: dept("MKT"), vendor: "Meta" });
    add("expense", "transport", "Зуслан шалгах шатахуун", 250_000 + (back % 3) * 80_000, 18, { department_id: dept("PART") });
    add("expense", "utilities", "Цахилгаан, интернэт", 310_000, 20);
    add("income", "commission", "zuca.mn захиалгын шимтгэл", 6_500_000 + (5 - back) * 1_200_000, 27, { vendor: "zuca.mn" });
    if (back % 2 === 0) add("income", "partner", "Зуслангийн байршуулалтын төлбөр", 1_500_000, 15);
    if (back <= 1 && projects[0]) {
      add("expense", "event", "Тайз, дуу хоолойн түрээс — урьдчилгаа", 1_200_000, 22, { project_id: projects[0].id, department_id: dept("MKT") });
    }
  }
  return { finance_entries, payroll };
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

function seedIdeas(profiles: Profile[]): Pick<DB, "ideas" | "idea_comments" | "idea_stickers" | "idea_strokes"> {
  const [a, b, c] = profiles;
  const idea = (body: string, color: string, x: number, y: number, by?: Profile, ago = 1): Idea => ({
    id: uid(),
    body,
    color,
    x,
    y,
    created_by: by?.id ?? null,
    created_at: daysAgo(ago),
    updated_at: daysAgo(ago),
  });
  const ideas = [
    idea("Зуслан бүрт 360° виртуал аялал хийвэл захиалга нэмэгдэх байх 🏕️", "yellow", 60, 50, a, 3),
    idea("Эцэг эхчүүдэд долоо хоног бүр хүүхдийнх нь зурагтай мэдээ илгээх", "pink", 340, 110, b, 2),
    idea("Telegram bot-оор зуслангийн сул орны тоог шууд харуулах", "blue", 120, 300, c, 1),
    idea("Зуны улирлын өмнө багийн hackathon 🚀", "green", 420, 360, a, 0),
  ];
  const comment = (p: Profile | undefined, body: string, at: Partial<IdeaComment>, ago = 0): IdeaComment =>
    ({ id: uid(), idea_id: null, thread_id: null, x: 0, y: 0, body, created_by: p?.id ?? null, created_at: daysAgo(ago), updated_at: daysAgo(ago), ...at });
  const root = comment(b, "Гоё санаа! Дроноор зураг авбал бүр гоё болно", { idea_id: ideas[0].id, x: 212, y: 120 }, 2);
  const free = comment(c, "Энэ хэсгийг дараагийн уулзалтаар ярилцъя ☕", { x: 640, y: 300 }, 1);
  const sticker = (i: number | null, p: Profile | undefined, emoji: string, x: number, y: number): IdeaSticker[] =>
    p ? [{ id: uid(), emoji, x, y, idea_id: i === null ? null : ideas[i].id, created_by: p.id, created_at: daysAgo(0), updated_at: daysAgo(0) }] : [];
  return {
    ideas,
    idea_comments: [
      root,
      comment(c, "Эхлээд 3 зуслан дээр туршиж үзье", { thread_id: root.id }, 1),
      comment(a, "Тийм ээ, би хариуцъя 🙌", { thread_id: root.id }),
      free,
    ],
    idea_strokes: [
      {
        id: uid(),
        points: [[300, 250], [330, 262], [360, 270], [392, 272], [420, 268], [440, 262]],
        color: "#ef4444",
        width: 4,
        created_by: a?.id ?? null,
        created_at: daysAgo(0),
        updated_at: daysAgo(0),
      },
    ],
    idea_stickers: [
      ...sticker(0, b, "💯", 195, 6),
      ...sticker(0, c, "🔥", 150, 2),
      ...sticker(1, a, "СУПЕР!", 170, 8),
      ...sticker(2, b, "🤔", 200, 4),
      ...sticker(3, c, "🚀", 196, 2),
      ...sticker(null, a, "🎉", 660, 100),
    ],
  };
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
  // v8: санхүү, файл
  if (!d.finance_entries) Object.assign(d, seedFinance(d.profiles, d.departments, d.projects));
  d.files ??= [];
  // v9: санааны самбар
  if (!d.ideas) Object.assign(d, seedIdeas(d.profiles));
  d.idea_stickers ??= [];
  d.idea_comments ??= [];
  d.idea_strokes ??= [];
  // Хуучин (санаанд заавал хамаарах) сэтгэгдлийг наалтын баруун доод буланд бөмбөлөг болгоно
  d.idea_comments.forEach((c) => {
    c.thread_id ??= null;
    c.x ??= NOTE_PIN_X;
    c.y ??= NOTE_PIN_Y;
  });
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

const FILES_KEY = "zuca-ops-demo-files";
function loadBlobs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FILES_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
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
      // Supabase-ийн cascade / set null-тэй адил
      d.payroll = d.payroll.filter((x) => x.profile_id !== id);
      d.files.forEach((f) => f.profile_id === id && (f.profile_id = null));
      d.finance_entries.forEach((e) => e.profile_id === id && (e.profile_id = null));
      d.ideas.forEach((x) => x.created_by === id && (x.created_by = null));
      d.idea_comments = d.idea_comments.filter((x) => x.created_by !== id);
      d.idea_strokes = d.idea_strokes.filter((x) => x.created_by !== id);
      d.idea_stickers = d.idea_stickers.filter((x) => x.created_by !== id);
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
      if (table === "projects") {
        d.tasks.forEach((t) => t.project_id === id && (t.project_id = null));
        d.finance_entries.forEach((e) => e.project_id === id && (e.project_id = null));
      }
      if (table === "finance_entries") d.files.forEach((f) => f.entry_id === id && (f.entry_id = null));
      if (table === "idea_comments") d.idea_comments = d.idea_comments.filter((x) => x.thread_id !== id);
      if (table === "ideas") {
        const roots = new Set(d.idea_comments.filter((x) => x.idea_id === id).map((x) => x.id));
        d.idea_comments = d.idea_comments.filter((x) => x.idea_id !== id && !(x.thread_id && roots.has(x.thread_id)));
        d.idea_stickers = d.idea_stickers.filter((x) => x.idea_id !== id);
      }
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

    async uploadFile(path, file) {
      // Demo: browser-ийн localStorage багтаамж ~5MB тул жижиг файл л хадгална
      if (file.size > 1.5 * 1048576) throw new Error("Demo горимд 1.5MB-аас бага файл л хадгална (Supabase-д 50MB хүртэл)");
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("Файл уншиж чадсангүй"));
        r.readAsDataURL(file);
      });
      const blobs = loadBlobs();
      blobs[path] = dataUrl;
      try {
        localStorage.setItem(FILES_KEY, JSON.stringify(blobs));
      } catch {
        throw new Error("Browser-ийн санах ой дүүрлээ — demo-д хуучин файлаа устгана уу");
      }
    },
    async fileUrl(path) {
      const url = loadBlobs()[path];
      if (!url) throw new Error("Файл олдсонгүй");
      return url;
    },
    async removeFileObject(path) {
      const blobs = loadBlobs();
      delete blobs[path];
      try {
        localStorage.setItem(FILES_KEY, JSON.stringify(blobs));
      } catch {}
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
