/**
 * Бодит өгөгдөл: МҮЗХ-ны зуслангийн жагсаалт (2026.05.28) + zuca.mn (2026.09.16).
 * camps-mn.json-г scripts/import_mn_camps.py үүсгэнэ.
 * Demo горим болон supabase/seed.sql хоёулаа үүнийг ашиглана.
 */
import type { CampOwnership, CampSeason, CampStage, TaskPriority, TaskStatus } from "./types";
import CAMPS_JSON from "./camps-mn.json";

export interface SeedCamp {
  key: string;
  name: string;
  stage: CampStage;
  season: CampSeason;
  aimag: string | null;
  soum?: string | null;
  address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  capacity?: number | null;
  price_from?: number | null;
  description?: string | null;
  photos_count?: number;
  ownership?: CampOwnership | null;
  register_no?: string | null;
  founded_year?: number | null;
  distance_km?: number | null;
  notes?: string | null;
}

type RawCamp = Omit<SeedCamp, "key"> & { src_no: number };

export const SEED_CAMPS: SeedCamp[] = (CAMPS_JSON as RawCamp[]).map(({ src_no, ...c }) => ({ key: `n${src_no}`, ...c }));

export interface SeedTask {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: number | null; // SEED_PEOPLE index
  camp?: string; // SEED_CAMPS key (n + МҮЗХ жагсаалтын №)
  dueOffset?: number; // өнөөдрөөс хэдэн хоног
  planMonths?: number; // энэ сараас хэдэн сарын дараа төлөвлөсөн (хугацаагүй)
  tags?: string[];
  completedDaysAgo?: number;
  createdDaysAgo?: number;
}

export const SEED_PEOPLE = [
  { full_name: "Оршихоо", email: "orshikh@zuca.mn", color: "#4f46e5", role: "admin" as const },
  { full_name: "Номин", email: "nomin@zuca.mn", color: "#0891b2", role: "member" as const },
  { full_name: "Тэмүүлэн", email: "temuulen@zuca.mn", color: "#ea580c", role: "member" as const },
  { full_name: "Сараа", email: "saraa@zuca.mn", color: "#16a34a", role: "member" as const },
];

export const SEED_TASKS: SeedTask[] = [
  { title: "Урандөшийн үнийн мэдээллийг zuca.mn-д оруулах", status: "todo", priority: "urgent", assignee: 1, camp: "n18", dueOffset: 0, tags: ["мэдээлэл"] },
  { title: "Цагаан нугын зураг 3+ болгох", description: "zuca.mn дээр 1 зурагтай. Зусланд фото авалт санал болгох.", status: "todo", priority: "high", assignee: 2, camp: "n40", dueOffset: 2, tags: ["зураг"] },
  { title: "Намрын нэг өдрийн хөтөлбөрийн landing хуудас", status: "in_progress", priority: "urgent", assignee: 0, dueOffset: 1, tags: ["маркетинг"], createdDaysAgo: 5 },
  { title: "Joyful Family Camp-ийн багтаамж тодруулах", status: "todo", priority: "medium", assignee: 3, camp: "n73", dueOffset: 4 },
  { title: "Гүн нуур зуслантай холбогдох", status: "todo", priority: "high", assignee: 0, camp: "n33", dueOffset: 6, tags: ["уулзалт"] },
  { title: "Шимтгэлийн загварын танилцуулга илгээх (5 зуслан)", status: "in_progress", priority: "high", assignee: 1, dueOffset: -1, tags: ["борлуулалт"], createdDaysAgo: 8 },
  { title: "Скаут зуслантай гэрээний төсөл", status: "review", priority: "high", assignee: 0, camp: "n44", dueOffset: 3, tags: ["гэрээ"] },
  { title: "Facebook сурталчилгааны 9-р сарын төсөв", status: "review", priority: "medium", assignee: 2, dueOffset: 5, tags: ["маркетинг"] },
  { title: "Буянт хотхон — анхны холбоо барих", status: "todo", priority: "low", assignee: 3, camp: "n17", dueOffset: 12 },
  { title: "Найрамдлын эрдэнэстэй холбогдох", status: "todo", priority: "medium", assignee: null, camp: "n5", dueOffset: 7 },
  { title: "Сургуулиудын жагсаалт (УБ, 50 сургууль)", status: "in_progress", priority: "medium", assignee: 3, dueOffset: 9, tags: ["сургууль"], createdDaysAgo: 3 },
  { title: "Лого танилтын судалгааны асуулга", status: "todo", priority: "low", assignee: 2, dueOffset: 14, tags: ["брэнд"] },
  { title: "Шонхорын танилцуулга текст бичих", status: "todo", priority: "urgent", assignee: 0, camp: "n2", dueOffset: -2, tags: ["гэрээ"], createdDaysAgo: 6 },
  { title: "Нарлагийн сэтгэгдлүүдийг нийтлэх", status: "done", priority: "low", assignee: 1, camp: "n57", completedDaysAgo: 1, createdDaysAgo: 4 },
  { title: "Галаксийн 9-р сарын орлогын тайлан", status: "done", priority: "high", assignee: 0, camp: "n54", completedDaysAgo: 2, createdDaysAgo: 6 },
  { title: "Мөрөөдлийн намрын ээлж нэмэх", status: "done", priority: "medium", assignee: 3, camp: "n41", completedDaysAgo: 3, createdDaysAgo: 7 },
  { title: "Номтын байршлыг газрын зураг дээр", status: "done", priority: "medium", assignee: 2, camp: "n46", completedDaysAgo: 5, createdDaysAgo: 9 },
  { title: "Төлбөрийн алдааны хүсэлт шалгах", status: "done", priority: "urgent", assignee: 0, completedDaysAgo: 8, createdDaysAgo: 9 },
  { title: "Шинэ зуслангийн onboarding checklist", status: "done", priority: "medium", assignee: 1, completedDaysAgo: 10, createdDaysAgo: 16 },
  { title: "Нарс зуслангийн зургийг шинэчлэх", status: "done", priority: "low", assignee: 2, camp: "n56", completedDaysAgo: 13, createdDaysAgo: 15 },
  { title: "Зуны улирлын үр дүнгийн тайлан", status: "done", priority: "high", assignee: 0, completedDaysAgo: 17, createdDaysAgo: 22 },
  { title: "English Camp-ийн зургийг авах", status: "done", priority: "medium", assignee: 3, camp: "n49", completedDaysAgo: 20, createdDaysAgo: 25 },
  { title: "Сэлбэ зуслантай дахин холбогдох", status: "done", priority: "low", assignee: 1, camp: "n51", completedDaysAgo: 24, createdDaysAgo: 30 },
  // ── Ирэх саруудын төлөвлөгөө ──
  { title: "Намрын 1 өдрийн хөтөлбөрийн тайлан (сургуулиуд)", status: "todo", priority: "medium", assignee: 0, planMonths: 1, tags: ["тайлан"] },
  { title: "Холбогдоогүй 20 зуслантай утсаар холбогдох", status: "todo", priority: "high", assignee: 1, planMonths: 1, tags: ["борлуулалт"] },
  { title: "Өвлийн амралтын хөтөлбөрийн санал бэлдэх", status: "todo", priority: "medium", assignee: 2, planMonths: 2, tags: ["маркетинг"] },
  { title: "2026 оны жилийн тайлан", status: "todo", priority: "high", assignee: 0, planMonths: 3, tags: ["тайлан"] },
  { title: "2027 зуны улирлын гэрээ байгуулах (15 зуслан)", status: "todo", priority: "urgent", assignee: 1, planMonths: 5, tags: ["гэрээ"] },
  { title: "Зуны бүртгэлийн сурталчилгааны кампанит ажил", status: "todo", priority: "high", assignee: 2, planMonths: 7, tags: ["маркетинг"] },
  { title: "Зуслангийн ээлжийн үнийг zuca.mn-д шинэчлэх", status: "todo", priority: "high", assignee: 3, planMonths: 7, tags: ["мэдээлэл"] },
];
