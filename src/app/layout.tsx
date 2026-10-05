import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import { DataProvider } from "@/lib/data/store";
import { Toaster } from "@/components/ui/toaster";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZUCA Ops",
  description: "ZUCA багийн дотоод систем — ажил, зуслан, AI туслах",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#08080d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        {/* Хуудас ачаалахаас өмнө light/dark горимыг тавина (анивчихгүй) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <DataProvider>
          {children}
          <Toaster />
        </DataProvider>
      </body>
    </html>
  );
}
