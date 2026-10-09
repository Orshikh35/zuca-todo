"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

/** Самбарын баганын доор: гарчиг бичээд Enter дарахад ажил нэмнэ */
export function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [on, setOn] = useState(false);
  const [v, setV] = useState("");
  if (!on) {
    return (
      <button
        onClick={() => setOn(true)}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm text-zinc-500 transition hover:bg-surface-solid hover:text-zinc-800"
      >
        <Plus size={15} /> Нэмэх
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <input
        autoFocus
        className="field rounded-[1.25rem]"
        placeholder="Гарчиг бичээд Enter…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => !v && setOn(false)}
        onKeyDown={(e) => e.key === "Escape" && (setV(""), setOn(false))}
      />
    </form>
  );
}
