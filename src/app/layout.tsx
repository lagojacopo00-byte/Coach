import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "../components/nav";
import { SwRegister } from "../components/sw-register";

export const metadata: Metadata = {
  title: "Coach Maratona",
  description: "Piano di 16 settimane per la Maratona di Roma 2027: sub 4h.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Coach", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full">
        <main className="mx-auto max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
        <Nav />
        <SwRegister />
      </body>
    </html>
  );
}
