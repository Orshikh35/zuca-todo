import type { ApprovalKind, ApprovalStatus, CampOwnership, CampSeason, CampStage, Role, TaskPriority, TaskStatus } from "./types";

export const STATUSES: { id: TaskStatus; label: string; hint: string }[] = [
  { id: "todo", label: "Хийх", hint: "Эхлээгүй" },
  { id: "in_progress", label: "Хийж байна", hint: "Ажиллаж байгаа" },
  { id: "review", label: "Шалгах", hint: "Хяналт хүлээж буй" },
  { id: "done", label: "Дууссан", hint: "Хаагдсан" },
];

export const PRIORITIES: {
  id: TaskPriority;
  label: string;
  short: string;
  /** tailwind classes */
  chip: string;
  dot: string;
  bar: string;
}[] = [
  { id: "urgent", label: "Яаралтай", short: "P0", chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", bar: "bg-red-500" },
  { id: "high", label: "Өндөр", short: "P1", chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", bar: "bg-orange-500" },
  { id: "medium", label: "Дунд", short: "P2", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", bar: "bg-sky-500" },
  { id: "low", label: "Бага", short: "P3", chip: "bg-zinc-100 text-zinc-600 ring-zinc-200", dot: "bg-zinc-400", bar: "bg-zinc-400" },
];

export const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const STAGES: { id: CampStage; label: string; hint: string; dot: string }[] = [
  { id: "lead", label: "Холбогдоогүй", hint: "Жагсаалтад байгаа", dot: "bg-zinc-400" },
  { id: "contacted", label: "Холбогдсон", hint: "Яриа эхэлсэн", dot: "bg-sky-500" },
  { id: "onboarding", label: "Бүртгэж байна", hint: "Мэдээлэл цуглуулж буй", dot: "bg-amber-500" },
  { id: "active", label: "ZUCA дээр идэвхтэй", hint: "Ээлж зарж байгаа", dot: "bg-emerald-500" },
  { id: "inactive", label: "Идэвхгүй", hint: "Татгалзсан / зогссон", dot: "bg-rose-400" },
];

export const OWNERSHIPS: { id: CampOwnership; label: string; short: string; chip: string }[] = [
  { id: "private", label: "Хувийн", short: "Хувийн", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  { id: "local", label: "Орон нутгийн өмч", short: "Орон нутаг", chip: "bg-teal-50 text-teal-700 ring-teal-200" },
  { id: "state", label: "Төрийн өмч", short: "Төрийн", chip: "bg-blue-50 text-blue-700 ring-blue-200" },
  { id: "labor", label: "Хөдөлмөр зуслан", short: "Хөдөлмөр", chip: "bg-lime-50 text-lime-800 ring-lime-200" },
  { id: "org", label: "Байгууллагын дэргэд", short: "Байгууллага", chip: "bg-pink-50 text-pink-700 ring-pink-200" },
];

export const SEASONS: { id: CampSeason; label: string }[] = [
  { id: "summer", label: "Зуны" },
  { id: "autumn", label: "Намрын (1 өдөр)" },
  { id: "all_year", label: "Жилийн турш" },
];

export const AIMAGS = [
  "Улаанбаатар",
  "Архангай",
  "Баян-Өлгий",
  "Баянхонгор",
  "Булган",
  "Говь-Алтай",
  "Говьсүмбэр",
  "Дархан-Уул",
  "Дорноговь",
  "Дорнод",
  "Дундговь",
  "Завхан",
  "Орхон",
  "Өвөрхангай",
  "Өмнөговь",
  "Сүхбаатар",
  "Сэлэнгэ",
  "Төв",
  "Увс",
  "Ховд",
  "Хөвсгөл",
  "Хэнтий",
];

/** ZUCA-д сонгох эрх хоёр: Админ, Ажилтан. director/manager — хуучин өгөгдөлд таарах (сонгох боломжгүй) */
export const ROLES: { id: Role; label: string; hint: string; chip: string; selectable: boolean }[] = [
  { id: "admin", label: "Админ", hint: "Бүх ажилтны ажил, явц, тохиргоог харна", chip: "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900 dark:ring-white", selectable: true },
  { id: "member", label: "Ажилтан", hint: "Өөрийн болон эзэнгүй ажлаа харна", chip: "bg-zinc-100 text-zinc-600 ring-zinc-200", selectable: true },
  { id: "director", label: "Админ", hint: "Хуучин «Удирдлага» — админтай адил", chip: "bg-violet-50 text-violet-700 ring-violet-200", selectable: false },
  { id: "manager", label: "Хэлтсийн дарга", hint: "Хуучин эрх — Админ эсвэл Ажилтан болгоно уу", chip: "bg-sky-50 text-sky-700 ring-sky-200", selectable: false },
];

export const APPROVAL_KINDS: { id: ApprovalKind; label: string; hint: string; money?: boolean; dates?: boolean }[] = [
  { id: "leave", label: "Чөлөө / амралт", hint: "Эхлэх, дуусах өдөр", dates: true },
  { id: "purchase", label: "Худалдан авалт", hint: "Юу, хэдэн төгрөг", money: true },
  { id: "expense", label: "Зардлын нөхөн олговор", hint: "Баримттай зардал", money: true },
  { id: "trip", label: "Томилолт", hint: "Хаашаа, хэзээ", dates: true, money: true },
  { id: "general", label: "Бусад", hint: "Ерөнхий хүсэлт" },
];

export const APPROVAL_STATUSES: { id: ApprovalStatus; label: string; chip: string }[] = [
  { id: "pending", label: "Хүлээгдэж буй", chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  { id: "approved", label: "Батлагдсан", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { id: "rejected", label: "Татгалзсан", chip: "bg-red-50 text-red-700 ring-red-200" },
  { id: "cancelled", label: "Цуцалсан", chip: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
];

export const DEPARTMENT_COLORS = ["#4f46e5", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#7c3aed", "#ca8a04", "#0d9488", "#64748b"];
