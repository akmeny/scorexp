import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "ScoreXP",
  description: "Real-time football scores powered by API-Sports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
