import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { shiftDate, todayIn, type OrgSnapshot } from "../agent/digest";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "../supabase/client";
import type { Profile } from "../types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: e instanceof Error ? e.message : "Алдаа гарлаа" }, { status: 500 });
}

/** Service role — зөвхөн server дээр (cron, Telegram webhook). RLS-ийг тойрно. */
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sessionClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Route handler-оос дуудагдсан үед session шинэчлэл proxy-д хийгдэнэ */
        }
      },
    },
  });
}

export async function loadSnapshot(sb: SupabaseClient): Promise<OrgSnapshot> {
  const since = shiftDate(todayIn(), -14);
  const [p, t, d, a, r] = await Promise.all([
    sb.from("profiles").select("*"),
    sb.from("tasks").select("*").neq("status", "done"),
    sb.from("departments").select("*").order("position"),
    sb.from("approvals").select("*").eq("status", "pending"),
    sb.from("daily_reports").select("*").gte("date", since),
  ]);
  const err = [p, t, d, a, r].find((x) => x.error)?.error;
  if (err) throw new HttpError(500, err.message);
  return {
    profiles: p.data as Profile[],
    tasks: t.data!,
    departments: d.data!,
    approvals: a.data!,
    daily_reports: r.data!,
  };
}

export interface Ctx {
  mode: "demo" | "supabase";
  me: Profile;
  snap: OrgSnapshot;
  /** agent_runs-д бичих (demo горимд client өөрөө бичнэ) */
  sb: SupabaseClient | null;
}

/**
 * API хүсэлтийн контекст.
 * Supabase горимд: cookie-гоор нэвтэрсэн хэрэглэгчийг шалгаж, өгөгдлийг RLS-ээр server дээр ачаална
 * (client-ийн илгээсэн өгөгдөлд итгэхгүй — хүлээн авагчийн имэйл, chat id-г хуурах боломжгүй).
 * Demo горимд: өгөгдөл browser-т л байдаг тул body-гоос авна.
 */
export async function requestContext(body: { snapshot?: OrgSnapshot; me_id?: string }): Promise<Ctx> {
  if (!isSupabaseConfigured) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_AGENT !== "1") {
      throw new HttpError(403, "Demo горимд агент зөвхөн локал орчинд ажиллана (ALLOW_DEMO_AGENT=1)");
    }
    const snap = body.snapshot;
    const me = snap?.profiles.find((p) => p.id === body.me_id);
    if (!snap || !me) throw new HttpError(400, "Demo өгөгдөл дутуу");
    return { mode: "demo", me, snap, sb: null };
  }
  const sb = await sessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new HttpError(401, "Нэвтрээгүй байна");
  const snap = await loadSnapshot(sb);
  const me = snap.profiles.find((p) => p.user_id === user.id);
  if (!me) throw new HttpError(403, "Ажилтны бүртгэл олдсонгүй");
  return { mode: "supabase", me, snap, sb };
}

/** Нэвтэрсэн хүн + түүний RLS-тэй Supabase client (чат, агентын хөнгөн API-д) */
export async function requireMe(): Promise<{ sb: SupabaseClient; me: Profile }> {
  if (!isSupabaseConfigured) throw new HttpError(400, "Чат зөвхөн Supabase холбогдсон үед ажиллана");
  const sb = await sessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new HttpError(401, "Нэвтрээгүй байна");
  const { data: me, error } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!me) throw new HttpError(403, "Ажилтны бүртгэл олдсонгүй");
  return { sb, me: me as Profile };
}

export function appUrl(req: Request) {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}
