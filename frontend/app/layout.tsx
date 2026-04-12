import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "ScoreXP",
  description: "API-Sports destekli günlük futbol skorları ve canlı güncellemeler.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}
