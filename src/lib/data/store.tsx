"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured } from "../supabase/client";
import type { Camp, CampInput, Profile, ProfileInput, Task, TaskInput } from "../types";
import { createDemoRepo } from "./demo-repo";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase-repo";

let repoSingleton: Repo | null = null;
export function getRepo(): Repo {
  if (!repoSingleton) repoSingleton = isSupabaseConfigured ? createSupabaseRepo() : createDemoRepo();
  return repoSingleton;
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
  profileById: Map<string, Profile>;
  campById: Map<string, Camp>;

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
    const [u, p, t, c] = await Promise.allSettled([
      repo.currentUser(),
      repo.listProfiles(),
      repo.listTasks(),
      repo.listCamps(),
    ]);
    if (u.status === "fulfilled") setMe(u.value);
    if (p.status === "fulfilled") setProfiles(p.value);
    if (t.status === "fulfilled") setTasks(t.value);
    if (c.status === "fulfilled") setCamps(c.value);

    const failed = [u, p, t, c].find((r) => r.status === "rejected");
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
    return {
      mode: repo.mode,
      ready,
      me,
      profiles,
      tasks,
      camps,
      profileById,
      campById,

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
          return t;
        } catch (e) {
          fail(e);
        }
      },
      async updateTask(id, patch) {
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

      refresh,
      async signOut() {
        await repo.signOut();
        window.location.href = "/login";
      },
      toasts,
      toast,
      dismissToast,
    };
  }, [repo, ready, me, profiles, tasks, camps, toasts, toast, dismissToast, refresh, fail]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
