import { getSupabaseBrowser } from "../supabase/client";
import type { Camp, Profile, Rows, TableName, Task } from "../types";
import type { Repo } from "./repo";

/** Схем ажиллуулаагүй үед PostgREST-ийн ойлгомжгүй мессежийг зааварчилгаагаар солино */
/** Хувийн (public биш) bucket — зөвхөн админ уншина (schema.sql v8) */
const BUCKET = "zuca-files";

const SCHEMA_MISSING =
  "Supabase-д хүснэгт үүсээгүй байна. Dashboard → SQL Editor дээр supabase/schema.sql-ийг бүтнээр нь paste хийгээд Run дарна уу.";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    // PGRST205 = "Could not find the table ... in the schema cache"
    throw new Error(res.error.code === "PGRST205" ? SCHEMA_MISSING : res.error.message);
  }
  return res.data as T;
}

// Серверээс тооцогдох талбаруудыг patch-аас хасна
function clean<T extends object>(patch: T) {
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = patch as Record<string, unknown>;
  return rest;
}

export function createSupabaseRepo(): Repo {
  const sb = getSupabaseBrowser();

  return {
    mode: "supabase",

    /**
     * Нэвтэрсэн хэрэглэгчийн ажилтны мөрийг олно.
     * Байхгүй бол ижил имэйлтэй бүртгэлтэй ажилтантай холбоно, эс бөгөөс шинээр үүсгэнэ.
     */
    async currentUser() {
      const { data } = await sb.auth.getUser();
      const u = data.user;
      if (!u) return null;
      const email = u.email ?? "";
      const name = (u.user_metadata?.full_name as string | undefined) || email.split("@")[0] || "Би";

      const linked = await sb.from("profiles").select("*").eq("user_id", u.id).maybeSingle();
      if (linked.data) return linked.data as Profile;

      if (email) {
        const byEmail = await sb.from("profiles").select("*").is("user_id", null).ilike("email", email).maybeSingle();
        if (byEmail.data) {
          const res = await sb
            .from("profiles")
            .update({ user_id: u.id, active: true })
            .eq("id", (byEmail.data as Profile).id)
            .select()
            .single();
          if (res.data) return res.data as Profile;
        }
      }

      const created = await sb.from("profiles").insert({ user_id: u.id, full_name: name, email }).select().single();
      if (created.data) return created.data as Profile;

      // Хамгийн муудаа UI зогсохгүйн тулд түр объект
      return {
        id: u.id,
        user_id: u.id,
        full_name: name,
        email,
        phone: null,
        job_title: null,
        color: "#4f46e5",
        role: "member",
        department_id: null,
        telegram_chat_id: null,
        notify_email: true,
        notify_telegram: true,
        active: true,
        note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUp(email, password, fullName) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(error.message);
      return { needsConfirm: !data.session };
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async listProfiles() {
      return must(await sb.from("profiles").select("*").order("active", { ascending: false }).order("full_name")) as Profile[];
    },
    async createProfile(input) {
      return must(await sb.from("profiles").insert(clean(input)).select().single()) as Profile;
    },
    async updateProfile(id, patch) {
      return must(await sb.from("profiles").update(clean(patch)).eq("id", id).select().single()) as Profile;
    },
    async deleteProfile(id) {
      must(await sb.from("profiles").delete().eq("id", id));
    },

    async listTasks() {
      return must(await sb.from("tasks").select("*").order("position")) as Task[];
    },
    async createTask(input) {
      return must(await sb.from("tasks").insert(clean(input)).select().single()) as Task;
    },
    async updateTask(id, patch) {
      return must(await sb.from("tasks").update(clean(patch)).eq("id", id).select().single()) as Task;
    },
    async deleteTask(id) {
      must(await sb.from("tasks").delete().eq("id", id));
    },

    async listCamps() {
      return must(await sb.from("camps").select("*").order("position")) as Camp[];
    },
    async createCamp(input) {
      return must(await sb.from("camps").insert(clean(input)).select().single()) as Camp;
    },
    async updateCamp(id, patch) {
      return must(await sb.from("camps").update(clean(patch)).eq("id", id).select().single()) as Camp;
    },
    async deleteCamp(id) {
      must(await sb.from("camps").delete().eq("id", id));
    },
    async importCamps(inputs) {
      if (!inputs.length) return [];
      return must(await sb.from("camps").insert(inputs.map(clean)).select()) as Camp[];
    },

    async list<K extends TableName>(table: K) {
      if (table === "departments" || table === "projects") return must(await sb.from(table).select("*").order("position")) as Rows[K][];
      // Түүхэн мөрүүд хязгааргүй өснө — сүүлийнхийг л ачаална
      const limit = table === "agent_runs" ? 300 : 3000;
      return must(await sb.from(table).select("*").order("created_at", { ascending: false }).limit(limit)) as Rows[K][];
    },
    async insert<K extends TableName>(table: K, input: Partial<Rows[K]>) {
      return must(await sb.from(table).insert(clean(input)).select().single()) as Rows[K];
    },
    async patch<K extends TableName>(table: K, id: string, patch: Partial<Rows[K]>) {
      return must(await sb.from(table).update(clean(patch)).eq("id", id).select().single()) as Rows[K];
    },
    async remove(table, id) {
      must(await sb.from(table).delete().eq("id", id));
    },

    async projectProgress() {
      const { data, error } = await sb.rpc("project_progress");
      // Схем v7 ажиллуулаагүй бол клиент өөрийн харагдах ажлаар тооцно
      if (error || !data) return {};
      const out: Record<string, { total: number; done: number }> = {};
      for (const r of data as { project_id: string; total: number; done: number }[]) {
        out[r.project_id] = { total: Number(r.total), done: Number(r.done) };
      }
      return out;
    },

    async uploadFile(path, file) {
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) {
        throw new Error(
          /bucket not found/i.test(error.message)
            ? "Файлын сан үүсээгүй байна. Supabase SQL Editor дээр supabase/schema.sql-ийг дахин Run хийнэ үү."
            : error.message,
        );
      }
    },
    async fileUrl(path, downloadAs) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 120, downloadAs ? { download: downloadAs } : undefined);
      if (error || !data) throw new Error(error?.message ?? "Файлын холбоос үүссэнгүй");
      return data.signedUrl;
    },
    async removeFileObject(path) {
      const { error } = await sb.storage.from(BUCKET).remove([path]);
      if (error) throw new Error(error.message);
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const debounced = () => {
        clearTimeout(timer);
        timer = setTimeout(onChange, 400);
      };
      const channel = sb
        .channel("zuca-ops")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "camps" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "finance_entries" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "payroll" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "files" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "daily_reports" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "idea_comments" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "idea_stickers" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "idea_strokes" }, debounced)
        .subscribe();
      return () => {
        clearTimeout(timer);
        sb.removeChannel(channel);
      };
    },
  };
}
