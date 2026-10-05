"use client";

import type { OrgSnapshot } from "./digest";
import type { Profile } from "../types";

/**
 * Агентын API дуудах. Demo горимд өгөгдөл зөвхөн browser-т байгаа тул snapshot-ийг хамт илгээнэ;
 * Supabase горимд server өөрөө RLS-ээр ачаална.
 */
export async function agentFetch<T>(
  path: string,
  body: object,
  ctx: { mode: "demo" | "supabase"; me: Profile | null; snapshot: () => OrgSnapshot },
): Promise<T> {
  const payload = ctx.mode === "demo" ? { ...body, snapshot: ctx.snapshot(), me_id: ctx.me?.id } : body;
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Алдаа (${res.status})`);
  return json;
}

export interface AgentStatus {
  ai: boolean;
  model: string;
  email: boolean;
  telegram: boolean;
  bot: string | null;
  cron: boolean;
  /** /api/intake webhook (имэйл, zuca.mn, Facebook) */
  intake: boolean;
  serviceRole: boolean;
  mode: "demo" | "supabase";
}
