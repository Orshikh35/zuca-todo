/** Server/client хоёуланд ашиглана («use client»-гүй) */
export type ThemePref = "light" | "dark" | "system";
export const THEME_KEY = "zuca-theme";

/** <head>-д шууд ажиллана — хуудас анивчихгүйгээр зөв горимоор эхэлнэ */
export const themeScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(_){}})()`;
