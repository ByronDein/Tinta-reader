import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/themes";
import { Boot } from "@/components/ui/Boot";

export const metadata: Metadata = {
  title: "Lector PDF",
  description: "Lector de PDF cómodo para la vista. Todo ocurre en tu dispositivo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lector PDF", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4ECD8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="paper" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <div className="overlay-dim" aria-hidden />
        <div className="overlay-warm" aria-hidden />
        <Boot />
      </body>
    </html>
  );
}
