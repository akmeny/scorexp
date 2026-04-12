import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "ScoreXP",
  description: "Today's football scores and live updates powered by API-Sports.",
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
