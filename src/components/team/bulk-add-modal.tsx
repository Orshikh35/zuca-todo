"use client";

import { FileUp, Loader2, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { ROLES } from "@/lib/constants";
import { parseCSV } from "@/lib/csv";
import { getRepo, useStore } from "@/lib/data/store";
import { canSetRole } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MEMBER_COLORS } from "./member-modal";

/** Баганын нэрийг таних (Монгол / англи) */
const HEADERS: Record<string, string[]> = {
  name: ["нэр", "овог нэр", "бүтэн нэр", "name", "full name", "full_name"],
  email: ["имэйл", "и-мэйл", "email", "e-mail", "mail"],
  phone: ["утас", "утасны дугаар", "phone", "mobile"],
  job: ["албан тушаал", "тушаал", "position", "job", "job title", "title"],
  dept: ["хэлтэс", "нэгж", "department", "dept"],
};
const DEFAULT_ORDER = ["name", "email", "phone", "job", "dept"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Row {
  name: string;
  email: string;
  phone: string;
  job: string;
  deptText: string;
  deptId: string | null;
  status: "new" | "exists" | "dupe" | "invalid";
  note?: string;
}

/** Excel / Google Sheets-ээс хуулсан эсвэл CSV файлаас олон ажилтныг нэг дор бүртгэнэ */
export function BulkAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, profiles, departments, refresh, toast } = useStore();
  const [text, setText] = useState("");
  const [defaultDept, setDefaultDept] = useState(me?.role === "manager" ? me.department_id ?? "" : "");
  const [role, setRole] = useState<Role>("member");
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<Row[]>(() => {
    const table = parseCSV(text).map((r) => r.map((c) => c.trim()));
    if (!table.length) return [];
    // Эхний мөр гарчиг уу?
    const first = table[0].map((c) => c.toLowerCase());
    const hasHeader = first.some((c) => HEADERS.name.includes(c) || HEADERS.email.includes(c));
    const order = hasHeader
      ? first.map((h) => Object.keys(HEADERS).find((k) => HEADERS[k].includes(h)) ?? "")
      : DEFAULT_ORDER;
    const body = hasHeader ? table.slice(1) : table;

    const known = new Set(profiles.map((p) => p.email.toLowerCase()).filter(Boolean));
    const seen = new Set<string>();
    const findDept = (v: string) => {
      const s = v.trim().toLowerCase();
      if (!s) return null;
      return departments.find((d) => d.name.toLowerCase() === s || d.code?.toLowerCase() === s)?.id ?? null;
    };

    return body.map((cells) => {
      const get = (k: string) => cells[order.indexOf(k)] ?? "";
      // Имэйлийг байрлалаас үл хамааран олно (баганыг андуурсан ч)
      const email = (get("email") || cells.find((c) => EMAIL.test(c)) || "").toLowerCase();
      const row: Row = {
        name: get("name"),
        email,
        phone: get("phone"),
        job: get("job"),
        deptText: get("dept"),
        deptId: findDept(get("dept")),
        status: "new",
      };
      if (!row.name) return { ...row, status: "invalid", note: "Нэр алга" };
      if (email && !EMAIL.test(email)) return { ...row, status: "invalid", note: "Имэйл буруу" };
      if (email && known.has(email)) return { ...row, status: "exists", note: "Аль хэдийн бүртгэлтэй" };
      if (email && seen.has(email)) return { ...row, status: "dupe", note: "Жагсаалтад давхар" };
      if (email) seen.add(email);
      if (row.deptText && !row.deptId) row.note = `«${row.deptText}» хэлтэс олдсонгүй`;
      return row;
    });
  }, [text, profiles, departments]);

  const toAdd = rows.filter((r) => r.status === "new");
  const roleOptions = ROLES.filter((r) => r.selectable && (r.id === "member" || canSetRole(me, r.id)));

  function close() {
    if (saving) return;
    setText("");
    onClose();
  }

  async function readFile(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
  }

  async function save() {
    const repo = getRepo();
    setSaving({ done: 0, total: toAdd.length });
    let ok = 0;
    const failed: string[] = [];
    for (const [i, r] of toAdd.entries()) {
      try {
        await repo.createProfile({
          full_name: r.name,
          email: r.email,
          phone: r.phone || null,
          job_title: r.job || null,
          department_id: r.deptId ?? (defaultDept || null),
          role,
          color: MEMBER_COLORS[(profiles.length + i) % MEMBER_COLORS.length],
        });
        ok++;
      } catch (e) {
        failed.push(`${r.name}: ${e instanceof Error ? e.message : "алдаа"}`);
      }
      setSaving({ done: i + 1, total: toAdd.length });
    }
    await refresh().catch(() => {});
    setSaving(null);
    if (failed.length) toast(`${ok} нэмэгдлээ, ${failed.length} алдаатай — ${failed[0]}`, "error");
    else {
      toast(`${ok} ажилтан нэмэгдлээ`);
      close();
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Олон ажилтан нэг дор нэмэх"
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-xs text-zinc-500">
            {rows.length ? `${toAdd.length} шинэ · ${rows.length - toAdd.length} алгасна` : ""}
          </span>
          <Button variant="ghost" onClick={close} disabled={!!saving}>
            Болих
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!toAdd.length || !!saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
            {saving ? `${saving.done}/${saving.total}…` : `${toAdd.length} ажилтан нэмэх`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="bulk-text">
              Excel / Google Sheets-ээс хуулж буулгана, мөр бүр нэг хүн
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              <FileUp size={13} /> CSV файл сонгох
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </div>
          <textarea
            id="bulk-text"
            className="field min-h-36 font-mono text-xs"
            placeholder={"Нэр, Имэйл, Утас, Албан тушаал, Хэлтэс\nБат-Эрдэнэ, bat@zuca.mn, 99112233, Менежер, Партнершип\nСараа, saraa@zuca.mn, 88112233, Нягтлан, Санхүү"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Баганын дараалал: Нэр, Имэйл, Утас, Албан тушаал, Хэлтэс. Эхний мөрөнд гарчиг байвал дарааллыг өөрөө танина. Зөвхөн нэр заавал.
            Имэйлээр нь тухайн хүн дараа бүртгүүлэхэд бүртгэл нь автоматаар холбогдоно.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bulk-dept">
              Хэлтэс заагаагүй бол
            </label>
            <Select id="bulk-dept" className="field" value={defaultDept} onChange={(e) => setDefaultDept(e.target.value)}>
              <option value="">— Хэлтэсгүй</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="bulk-role">
              Эрхийн түвшин (бүгдэд)
            </label>
            <Select id="bulk-role" className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="scroll-thin max-h-72 overflow-auto rounded-xl border border-zinc-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Нэр</th>
                  <th className="px-3 py-2 font-medium">Имэйл</th>
                  <th className="px-3 py-2 font-medium">Утас</th>
                  <th className="px-3 py-2 font-medium">Албан тушаал</th>
                  <th className="px-3 py-2 font-medium">Хэлтэс</th>
                  <th className="px-3 py-2 font-medium">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={i} className={cn(r.status !== "new" && "text-zinc-400")}>
                    <td className="px-3 py-1.5 font-medium">{r.name || "—"}</td>
                    <td className="px-3 py-1.5">{r.email || "—"}</td>
                    <td className="px-3 py-1.5">{r.phone || "—"}</td>
                    <td className="px-3 py-1.5">{r.job || "—"}</td>
                    <td className="px-3 py-1.5">
                      {r.deptId ? departments.find((d) => d.id === r.deptId)?.name : r.deptText ? <span className="text-amber-600">{r.deptText}?</span> : "—"}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {r.status === "new" ? (
                        <span className={r.note ? "text-amber-600" : "text-emerald-600"}>{r.note ?? "Шинэ"}</span>
                      ) : (
                        <span className={r.status === "invalid" ? "text-red-600" : ""}>{r.note}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
