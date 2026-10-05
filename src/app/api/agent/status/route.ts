import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AI_MODEL, aiConfigured } from "@/lib/server/ai";
import { emailConfigured, telegramConfigured } from "@/lib/server/notify";

/** Аль интеграц тохируулагдсаныг UI-д харуулна (нууц утга буцаахгүй) */
export async function GET() {
  return Response.json({
    ai: aiConfigured(),
    model: AI_MODEL,
    email: emailConfigured(),
    telegram: telegramConfigured(),
    bot: process.env.TELEGRAM_BOT_USERNAME || null,
    cron: Boolean(process.env.CRON_SECRET),
    intake: Boolean(process.env.INTAKE_SECRET),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    mode: isSupabaseConfigured ? "supabase" : "demo",
  });
}
