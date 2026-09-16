/**
 * Demo горим: Supabase тохируулаагүй үед browser-ийн localStorage дээр ажиллана.
 */
import { SEED_CAMPS, SEED_PEOPLE, SEED_TASKS } from "../seed-data";
import type { Camp, Profile, ProfileInput, Task } from "../types";
import { addDays, toISODate, uid } from "../utils";
import type { Repo } from "./repo";

const KEY = "zuca-ops-demo-v4";

interface DB {
  profiles: Profile[];
  tasks: Task[];
  camps: Camp[];
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
    active: true,
    note: null,
    created_at: nowISO(),
    updated_at: nowISO(),
    ...input,
  };
}
const daysAgo = (n: number) => addDays(new Date(), -n).toISOString();

export function buildSeed(): DB {
  const profiles: Profile[] = SEED_PEOPLE.map((p, i) => ({
    id: uid(),
    user_id: null,
    phone: null,
    job_title: ["Үүсгэн байгуулагч", "Партнершип", "Маркетинг", "Контент"][i] ?? null,
    active: true,
    note: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
    ...p,
  }));
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

  return { profiles, tasks, camps, session: null };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
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
