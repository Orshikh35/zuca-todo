"use client";

import { useCallback, useEffect, useState } from "react";

import { THEME_KEY, type ThemePref } from "./theme-script";

export type { ThemePref };

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const p = read();
    setPrefState(p);
    setDark(apply(p));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (read() === "system") setDark(apply("system"));
    };
    // Өөр товчоор сольсон бол энэ hook-ийн төлөвийг ч шинэчилнэ
    const onSync = () => {
      const next = read();
      setPrefState(next);
      setDark(document.documentElement.classList.contains("dark"));
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("zuca-theme", onSync);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("zuca-theme", onSync);
    };
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    try {
      if (p === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, p);
    } catch {
      /* private горимд хадгалахгүй ч ажиллана */
    }
    setPrefState(p);
    setDark(apply(p));
    window.dispatchEvent(new Event("zuca-theme"));
  }, []);

  /** Нэг товчоор: light ↔ dark (систем рүү буцаахыг цэснээс сонгоно) */
  const toggle = useCallback(() => setPref(dark ? "light" : "dark"), [dark, setPref]);

  return { pref, dark, setPref, toggle };
}
