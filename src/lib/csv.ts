import { OWNERSHIPS, STAGES } from "./constants";
import type { Camp, CampInput, CampStage } from "./types";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/** CSV толгойн нэр → талбар (Монгол, англи аль алиныг таньна) */
const HEADER_MAP: Record<string, keyof Camp> = {
  name: "name", нэр: "name", "зуслангийн нэр": "name",
  aimag: "aimag", аймаг: "aimag", province: "aimag",
  soum: "soum", сум: "soum", дүүрэг: "soum",
  address: "address", хаяг: "address", байршил: "address",
  lat: "lat", latitude: "lat", lng: "lng", lon: "lng", longitude: "lng",
  contact_person: "contact_person", contact: "contact_person", "холбоо барих хүн": "contact_person", хариуцагч: "contact_person",
  phone: "phone", утас: "phone", "утасны дугаар": "phone",
  email: "email", имэйл: "email", "и-мэйл": "email",
  website: "website", вэбсайт: "website", facebook: "facebook", фэйсбүүк: "facebook",
  age_min: "age_min", "нас доод": "age_min", age_max: "age_max", "нас дээд": "age_max",
  capacity: "capacity", багтаамж: "capacity",
  price_from: "price_from", price: "price_from", үнэ: "price_from",
  description: "description", тайлбар: "description",
  photos_count: "photos_count", зураг: "photos_count",
  notes: "notes", тэмдэглэл: "notes",
  stage: "stage", төлөв: "stage",
  ownership: "ownership", "өмчийн хэлбэр": "ownership",
  register_no: "register_no", "регистрийн дугаар": "register_no", регистр: "register_no",
  founded_year: "founded_year", "байгуулагдсан он": "founded_year",
  distance_km: "distance_km", "зай (км)": "distance_km", зай: "distance_km",
};

const NUMERIC = new Set(["lat", "lng", "age_min", "age_max", "capacity", "price_from", "photos_count", "founded_year", "distance_km"]);

export function csvToCamps(text: string): { camps: CampInput[]; unknownHeaders: string[] } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { camps: [], unknownHeaders: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const keys = headers.map((h) => HEADER_MAP[h]);
  const unknownHeaders = rows[0].filter((_, i) => !keys[i]);

  const camps: CampInput[] = [];
  rows.slice(1).forEach((r, idx) => {
    const c: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      if (!k) return;
      const v = (r[i] ?? "").trim();
      if (!v) return;
      if (NUMERIC.has(k)) {
        const n = Number(v.replace(/[\s,₮]/g, ""));
        if (!Number.isNaN(n)) c[k] = n;
      } else if (k === "stage") {
        const s = STAGES.find((x) => x.id === v || x.label.toLowerCase() === v.toLowerCase());
        if (s) c.stage = s.id as CampStage;
      } else if (k === "ownership") {
        const low = v.toLowerCase();
        const o = OWNERSHIPS.find((x) => x.id === low || x.label.toLowerCase() === low || low.includes(x.short.toLowerCase()));
        if (o) c.ownership = o.id;
      } else c[k] = v;
    });
    if (c.name) camps.push({ ...(c as CampInput), position: Date.now() + idx });
  });
  return { camps, unknownHeaders };
}

const EXPORT_COLS: (keyof Camp)[] = [
  "name", "stage", "ownership", "season", "aimag", "soum", "address", "lat", "lng", "contact_person", "phone", "email",
  "website", "facebook", "age_min", "age_max", "capacity", "price_from", "photos_count", "has_contract", "register_no", "founded_year", "distance_km", "notes",
];

export function campsToCSV(camps: Camp[], extra?: (c: Camp) => Record<string, string | number>) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const extraKeys = extra && camps[0] ? Object.keys(extra(camps[0])) : [];
  const head = [...EXPORT_COLS, ...extraKeys].join(",");
  const lines = camps.map((c) => {
    const ex = extra?.(c) ?? {};
    return [...EXPORT_COLS.map((k) => esc(c[k])), ...extraKeys.map((k) => esc(ex[k]))].join(",");
  });
  return "﻿" + [head, ...lines].join("\n");
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
