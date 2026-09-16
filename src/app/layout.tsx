import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { DataProvider } from "@/lib/data/store";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZUCA Ops",
  description: "ZUCA багийн дотоод удирдлага — ажил, зуслан, тайлан",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="font-sans">
        <DataProvider>
          {children}
          <Toaster />
        </DataProvider>
      </body>
    </html>
  );
}
