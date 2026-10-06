"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured } from "../supabase/client";
import type {
  AgentRun,
  Approval,
  ApprovalInput,
  Camp,
  CampInput,
  DailyReport,
  DailyReportInput,
  Department,
  DepartmentInput,
  Profile,
  ProfileInput,
  Project,
  ProjectInput,
  Rows,
  TableName,
  Task,
  TaskInput,
} from "../types";
import { canSeeTask, isAdmin } from "../permissions";
import { createDemoRepo } from "./demo-repo";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase-repo";

let repoSingleton: Repo | null = null;
export function getRepo(): Repo {
  if (!repoSingleton) repoSingleton = isSupabaseConfigured ? createSupabaseRepo() : createDemoRepo();
  return repoSingleton;
}

/** Хариуцагчид Telegram мэдэгдэл (server талд эрх шалгана) — UI-г хүлээлгэхгүй */
function notifyTask(taskId: string, reason: "created" | "assigned") {
  void fetch("/api/tasks/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, reason }),
  }).catch(() => {});
}

export interface ProjectProgress {
  total: number;
  done: number;
  /** null — ажилгүй төсөл */
  pct: number | null;
}

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
  action?: { label: string; run: () => void };
}

interface Store {
  mode: Repo["mode"];
  ready: boolean;
  me: Profile | null;
  profiles: Profile[];
  tasks: Task[];
  camps: Camp[];
  departments: Department[];
  projects: Project[];
  approvals: Approval[];
  dailyReports: DailyReport[];
  agentRuns: AgentRun[];
  profileById: Map<string, Profile>;
  campById: Map<string, Camp>;
  deptById: Map<string, Department>;
  projectById: Map<string, Project>;
  /** Төслийн явц: дууссан / нийт ажил */
  projectProgress(id: string): ProjectProgress;

  createProfile(input: ProfileInput): Promise<Profile | undefined>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  createTask(input: TaskInput): Promise<Task | undefined>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  createCamp(input: CampInput): Promise<Camp | undefined>;
  updateCamp(id: string, patch: Partial<Camp>): Promise<void>;
  deleteCamp(id: string): Promise<void>;
  importCamps(inputs: CampInput[]): Promise<number>;

  createDepartment(input: DepartmentInput): Promise<Department | undefined>;
  updateDepartment(id: string, patch: Partial<Department>): Promise<void>;
  deleteDepartment(id: string): Promise<void>;
  createProject(input: ProjectInput): Promise<Project | undefined>;
  updateProject(id: string, patch: Partial<Project>): Promise<void>;
  /** Төслийг устгана — ажлууд нь устахгүй, зөвхөн төслөөс салгана */
  deleteProject(id: string): Promise<void>;
  createApproval(input: ApprovalInput): Promise<Approval | undefined>;
  updateApproval(id: string, patch: Partial<Approval>): Promise<void>;
  deleteApproval(id: string): Promise<void>;
  /** Тухайн өдрийн тайланг үүсгэх эсвэл шинэчлэх */
  saveDailyReport(input: DailyReportInput): Promise<DailyReport | undefined>;
  logAgentRun(input: Omit<AgentRun, "id" | "created_at">): Promise<void>;
  refresh(): Promise<void>;
  signOut(): Promise<void>;

  toasts: Toast[];
  toast(text: string, tone?: Toast["tone"], action?: Toast["action"]): void;
  dismissToast(id: number): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore нь DataProvider дотор байх ёстой");
  return s;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const repo = getRepo();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok", action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Нэг query унасан ч бусад нь ачаалагдана. Ялангуяа `me` тогтоогдохгүй бол
  // Shell /login руу шидэж, middleware буцаагаад эцэс төгсгөлгүй гогцоо үүснэ.
  const refresh = useCallback(async () => {
    const [u, p, t, c, d, a, r, g, pj, pc] = await Promise.allSettled([
      repo.currentUser(),
      repo.listProfiles(),
      repo.listTasks(),
      repo.listCamps(),
      repo.list("departments"),
      repo.list("approvals"),
      repo.list("daily_reports"),
      repo.list("agent_runs"),
      repo.list("projects"),
      repo.projectProgress(),
    ]);
    if (u.status === "fulfilled") setMe(u.value);
    if (p.status === "fulfilled") setProfiles(p.value);
    if (t.status === "fulfilled") setTasks(t.value);
    if (c.status === "fulfilled") setCamps(c.value);
    if (d.status === "fulfilled") setDepartments(d.value);
    if (a.status === "fulfilled") setApprovals(a.value);
    if (r.status === "fulfilled") setDailyReports(r.value);
    if (g.status === "fulfilled") setAgentRuns(g.value);
    if (pj.status === "fulfilled") setProjects(pj.value);
    if (pc.status === "fulfilled") setProjectCounts(pc.value);

    // projects (v7) хүснэгт үүсээгүй байсан ч бусад хуудас ажилласаар байна
    const failed = [u, p, t, c, d, a, r, g].find((x) => x.status === "rejected");
    if (failed && failed.status === "rejected") throw failed.reason;
  }, [repo]);

  useEffect(() => {
    refresh()
      .catch((e: Error) => toast(`Өгөгдөл ачааллахад алдаа: ${e.message}`, "error"))
      .finally(() => setReady(true));
    return repo.subscribe(() => void refresh().catch(() => {}));
  }, [repo, refresh, toast]);

  const fail = useCallback(
    (e: unknown) => {
      toast(e instanceof Error ? e.message : "Алдаа гарлаа", "error");
      void refresh().catch(() => {});
    },
    [toast, refresh],
  );

  const store = useMemo<Store>(() => {
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const campById = new Map(camps.map((c) => [c.id, c]));
    const deptById = new Map(departments.map((d) => [d.id, d]));
    const projectById = new Map(projects.map((p) => [p.id, p]));

    /** Ерөнхий хүснэгтийн optimistic CRUD */
    function crud<K extends TableName>(table: K, setRows: React.Dispatch<React.SetStateAction<Rows[K][]>>) {
      return {
        async create(input: Partial<Rows[K]>) {
          try {
            const row = await repo.insert(table, input);
            setRows((prev) => [...prev, row]);
            return row;
          } catch (e) {
            fail(e);
          }
        },
        async update(id: string, patch: Partial<Rows[K]>) {
          setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
          try {
            const saved = await repo.patch(table, id, patch);
            setRows((prev) => prev.map((x) => (x.id === id ? saved : x)));
          } catch (e) {
            fail(e);
          }
        },
        async remove(id: string) {
          setRows((prev) => prev.filter((x) => x.id !== id));
          try {
            await repo.remove(table, id);
          } catch (e) {
            fail(e);
          }
        },
      };
    }
    const deptCrud = crud("departments", setDepartments);
    const apprCrud = crud("approvals", setApprovals);
    const dailyCrud = crud("daily_reports", setDailyReports);
    const projCrud = crud("projects", setProjects);

    // Ажилтан зөвхөн өөрийн + эзэнгүй ажлыг харна (Supabase дээр RLS давхар хамгаална; demo горимд энд шүүнэ)
    const visibleTasks = isAdmin(me) ? tasks : tasks.filter((t) => canSeeTask(me, t));

    // Админ бүх ажлыг хардаг тул шууд (optimistic) тоолно. Ажилтан бусдын ажлыг
    // харахгүй тул серверийн тоог (project_progress) ашиглана.
    const localCounts: Record<string, { total: number; done: number }> = {};
    for (const t of visibleTasks) {
      if (!t.project_id) continue;
      const c = (localCounts[t.project_id] ??= { total: 0, done: 0 });
      c.total++;
      if (t.status === "done") c.done++;
    }
    const projectProgress = (id: string): ProjectProgress => {
      const c = (!isAdmin(me) && projectCounts[id]) || localCounts[id] || { total: 0, done: 0 };
      return { ...c, pct: c.total ? Math.round((c.done / c.total) * 100) : null };
    };

    return {
      mode: repo.mode,
      ready,
      me,
      profiles,
      tasks: visibleTasks,
      camps,
      departments,
      approvals,
      dailyReports,
      agentRuns,
      profileById,
      campById,
      deptById,
      projects,
      projectById,
      projectProgress,

      async createProfile(input) {
        try {
          const p = await repo.createProfile(input);
          setProfiles((prev) => [...prev, p]);
          toast(`${p.full_name} бүртгэгдлээ`);
          return p;
        } catch (e) {
          fail(e);
        }
      },
      async updateProfile(id, patch) {
        setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
        try {
          const saved = await repo.updateProfile(id, patch);
          setProfiles((prev) => prev.map((p) => (p.id === id ? saved : p)));
          if (me?.id === id) setMe(saved);
        } catch (e) {
          fail(e);
        }
      },
      async deleteProfile(id) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        // Хариуцагчийг нь UI дээр шууд салгана
        setTasks((prev) => prev.map((t) => (t.assignee_id === id ? { ...t, assignee_id: null } : t)));
        setCamps((prev) => prev.map((c) => (c.owner_id === id ? { ...c, owner_id: null } : c)));
        setDepartments((prev) => prev.map((d) => (d.head_id === id ? { ...d, head_id: null } : d)));
        try {
          await repo.deleteProfile(id);
          toast("Ажилтан устгагдлаа");
        } catch (e) {
          fail(e);
        }
      },

      async createTask(input) {
        try {
          const t = await repo.createTask(input);
          setTasks((prev) => [...prev, t]);
          if (repo.mode === "supabase" && t.assignee_id && t.assignee_id !== me?.id) notifyTask(t.id, "created");
          return t;
        } catch (e) {
          fail(e);
        }
      },
      async updateTask(id, patch) {
        const before = tasks.find((t) => t.id === id);
        // Optimistic — UI шууд шинэчлэгдэнэ
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, ...patch };
            if (patch.status && patch.status !== t.status) {
              next.completed_at = patch.status === "done" ? new Date().toISOString() : null;
            }
            return next;
          }),
        );
        try {
          const saved = await repo.updateTask(id, patch);
          setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
          if (repo.mode === "supabase" && patch.assignee_id && patch.assignee_id !== before?.assignee_id && patch.assignee_id !== me?.id) {
            notifyTask(id, "assigned");
          }
        } catch (e) {
          fail(e);
        }
      },
      async deleteTask(id) {
        const removed = tasks.find((t) => t.id === id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        try {
          await repo.deleteTask(id);
          if (removed) {
            toast("Task устгагдлаа", "ok", {
              label: "Буцаах",
              run: () => {
                const { id: _i, created_at: _c, updated_at: _u, ...rest } = removed;
                void repo.createTask(rest).then((t) => setTasks((prev) => [...prev, t]));
              },
            });
          }
        } catch (e) {
          fail(e);
        }
      },

      async createCamp(input) {
        try {
          const c = await repo.createCamp(input);
          setCamps((prev) => [...prev, c]);
          return c;
        } catch (e) {
          fail(e);
        }
      },
      async updateCamp(id, patch) {
        setCamps((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        try {
          const saved = await repo.updateCamp(id, patch);
          setCamps((prev) => prev.map((c) => (c.id === id ? saved : c)));
        } catch (e) {
          fail(e);
        }
      },
      async deleteCamp(id) {
        setCamps((prev) => prev.filter((c) => c.id !== id));
        setTasks((prev) => prev.map((t) => (t.camp_id === id ? { ...t, camp_id: null } : t)));
        try {
          await repo.deleteCamp(id);
          toast("Зуслан устгагдлаа");
        } catch (e) {
          fail(e);
        }
      },
      async importCamps(inputs) {
        try {
          const created = await repo.importCamps(inputs);
          setCamps((prev) => [...prev, ...created]);
          return created.length;
        } catch (e) {
          fail(e);
          return 0;
        }
      },

      async createDepartment(input) {
        const d = await deptCrud.create({ position: Date.now(), ...input });
        if (d) toast(`${d.name} хэлтэс нэмэгдлээ`);
        return d;
      },
      updateDepartment: deptCrud.update,
      async deleteDepartment(id) {
        setProfiles((prev) => prev.map((p) => (p.department_id === id ? { ...p, department_id: null } : p)));
        setTasks((prev) =>
          prev.map((t) => ({
            ...t,
            department_id: t.department_id === id ? null : t.department_id,
            from_department_id: t.from_department_id === id ? null : t.from_department_id,
          })),
        );
        await deptCrud.remove(id);
        toast("Хэлтэс устгагдлаа");
      },

      async createProject(input) {
        const p = await projCrud.create({ status: "active", color: "#4f46e5", position: Date.now(), ...input });
        if (p) toast(`«${p.name}» төсөл үүслээ`);
        return p;
      },
      updateProject: projCrud.update,
      async deleteProject(id) {
        setTasks((prev) => prev.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)));
        await projCrud.remove(id);
        toast("Төсөл устгагдлаа — ажлууд нь хэвээр үлдлээ");
      },

      async createApproval(input) {
        const a = await apprCrud.create({ status: "pending", ...input });
        if (a) toast("Хүсэлт илгээгдлээ");
        return a;
      },
      updateApproval: apprCrud.update,
      deleteApproval: apprCrud.remove,

      async saveDailyReport(input) {
        const existing = dailyReports.find((r) => r.profile_id === input.profile_id && r.date === input.date);
        if (existing) {
          await dailyCrud.update(existing.id, input);
          toast("Тайлан шинэчлэгдлээ");
          return { ...existing, ...input };
        }
        const r = await dailyCrud.create(input);
        if (r) toast("Өдрийн тайлан илгээгдлээ");
        return r;
      },

      async logAgentRun(input) {
        try {
          const row = await repo.insert("agent_runs", input);
          setAgentRuns((prev) => [row, ...prev]);
        } catch {
          /* түүх бичигдэхгүй байсан ч илгээлт амжилттай */
        }
      },

      refresh,
      async signOut() {
        await repo.signOut();
        window.location.href = "/login";
      },
      toasts,
      toast,
      dismissToast,
    };
  }, [repo, ready, me, profiles, tasks, camps, departments, projects, projectCounts, approvals, dailyReports, agentRuns, toasts, toast, dismissToast, refresh, fail]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
