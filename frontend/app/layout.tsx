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
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = window.localStorage.getItem("scorexp-theme");
                  if (theme !== "light" && theme !== "dark") theme = "dark";
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (_) {
                  document.documentElement.dataset.theme = "dark";
                  document.documentElement.style.colorScheme = "dark";
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
