"use client";

import { Download, File, FileImage, FileSpreadsheet, FileText, FolderOpen, Receipt, Search, Trash2, Upload, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { pillField } from "@/components/bento";
import { Avatar, Button, Card, Empty, Select } from "@/components/ui";
import { FILE_FOLDERS } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { fmtSize } from "@/lib/finance";
import type { FileFolder, StoredFile } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

function FileIcon({ f }: { f: StoredFile }) {
  const m = f.mime ?? "";
  const n = f.name.toLowerCase();
  if (m.startsWith("image/")) return <FileImage size={18} className="text-violet-500" />;
  if (m === "application/pdf" || n.endsWith(".pdf")) return <FileText size={18} className="text-red-500" />;
  if (/sheet|excel|csv/.test(m) || /\.(xlsx?|csv)$/.test(n)) return <FileSpreadsheet size={18} className="text-emerald-600" />;
  if (/word|document/.test(m) || /\.docx?$/.test(n)) return <FileText size={18} className="text-sky-600" />;
  return <File size={18} className="text-zinc-400" />;
}

export function FilesTab() {
  const { files, profiles, profileById, financeEntries, uploadFiles, openFile, updateFile, deleteFile } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const who = params.get("who") ?? "";
  const [folder, setFolder] = useState<"" | FileFolder>(who ? "hr" : "");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const entryById = useMemo(() => new Map(financeEntries.map((e) => [e.id, e])), [financeEntries]);
  const scoped = useMemo(() => files.filter((f) => !who || f.profile_id === who), [files, who]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped
      .filter((f) => (!folder || f.folder === folder) && (!s || f.name.toLowerCase().includes(s)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [scoped, folder, q]);
  const count = (id: FileFolder) => scoped.filter((f) => f.folder === id).length;
  const person = who ? profileById.get(who) : null;
  const target: FileFolder = folder || (who ? "hr" : "other");

  async function upload(fl: File[]) {
    if (!fl.length) return;
    setBusy(true);
    await uploadFiles(fl, { folder: target, profile_id: who || null });
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Хавтас */}
      <Card className="h-fit p-2">
        {[{ id: "" as const, label: "Бүх файл", emoji: "🗂️" }, ...FILE_FOLDERS].map((x) => (
          <button
            key={x.id || "all"}
            onClick={() => setFolder(x.id)}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-full px-3.5 text-left text-sm font-medium transition",
              folder === x.id ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            <span>{x.emoji}</span>
            <span className="flex-1 truncate">{x.label}</span>
            <span className="tabular text-xs opacity-60">{x.id ? count(x.id) : scoped.length}</span>
          </button>
        ))}
      </Card>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400" />
            <input className={cn(pillField, "w-48 pl-9")} placeholder="Файл хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className={pillField} value={who} onChange={(e) => router.replace(`/finance?tab=files${e.target.value ? `&who=${e.target.value}` : ""}`)}>
            <option value="">Бүх ажилтан</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {!p.active ? " (гарсан)" : ""}
              </option>
            ))}
          </Select>
          {person && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pr-1 pl-1.5 text-xs">
              <Avatar profile={person} size={20} /> {person.full_name}-ийн хувийн хэрэг
              <button onClick={() => router.replace("/finance?tab=files")} className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-zinc-200" aria-label="Шүүлтүүр арилгах">
                <X size={12} />
              </button>
            </span>
          )}
          <Button variant="primary" className="ml-auto" onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={15} /> {busy ? "Хадгалж байна…" : "Файл оруулах"}
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
        >
          <Card className={cn("overflow-hidden transition", drag && "ring-2 ring-brand-500")}>
            <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500">
              Энд чирж оруулна → <b>{FILE_FOLDERS.find((x) => x.id === target)?.label}</b>
              {person && ` · ${person.full_name}`} хавтаст хадгалагдана. Зөвхөн админ харж, татна.
            </div>
            <div className="divide-y divide-zinc-100">
              {list.map((f) => {
                const owner = f.profile_id ? profileById.get(f.profile_id) : null;
                const entry = f.entry_id ? entryById.get(f.entry_id) : null;
                return (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                    <FileIcon f={f} />
                    <div className="min-w-0 flex-1">
                      <button onClick={() => void openFile(f)} className="block max-w-full cursor-pointer truncate text-left text-sm font-medium hover:underline">
                        {f.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
                        <span>{fmtSize(f.size)}</span>
                        <span>· {relativeTime(f.created_at)}</span>
                        {f.created_by && <span>· {profileById.get(f.created_by)?.full_name}</span>}
                        {entry && (
                          <span className="inline-flex items-center gap-0.5">
                            · <Receipt size={10} /> {entry.title}
                          </span>
                        )}
                      </div>
                    </div>
                    {owner && <Avatar profile={owner} size={22} />}
                    <Select
                      className="field hidden h-8 w-auto rounded-full py-0 text-xs sm:block"
                      value={f.folder}
                      onChange={(e) => void updateFile(f.id, { folder: e.target.value as FileFolder })}
                      aria-label="Хавтас"
                    >
                      {FILE_FOLDERS.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </Select>
                    <button onClick={() => void openFile(f, true)} title="Татах" className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
                      <Download size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm !== f.id) return setConfirm(f.id);
                        setConfirm(null);
                        void deleteFile(f);
                      }}
                      title="Устгах"
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600",
                        confirm === f.id ? "bg-red-50 px-2.5 text-xs font-medium text-red-600" : "w-8",
                      )}
                    >
                      <Trash2 size={14} />
                      {confirm === f.id && "Устгах уу?"}
                    </button>
                  </div>
                );
              })}
              {!list.length && (
                <Empty
                  icon={<FolderOpen size={30} />}
                  title={q ? "Хайлтад тохирох файл алга" : "Энд файл алга"}
                  hint="Гэрээ, баримт, цалингийн хүснэгт, ажилтны бичиг баримтаа чирж оруулна уу"
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
