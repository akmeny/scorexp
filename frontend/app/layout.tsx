import type { Metadata } from "next";
import "@/app/globals.css";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { themeInitScript } from "@/lib/theme";

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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeSwitcher />
        {children}
      </body>
    </html>
  );
}
