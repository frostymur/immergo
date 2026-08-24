import type { Metadata } from "next";
import { Inter, Shantell_Sans, Bitter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });
const shantell = Shantell_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-hand",
});
const bitter = Bitter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-board-serif",
});

export const metadata: Metadata = {
  title: "Immergo",
  description: "Learn anything. Ace everything.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${shantell.variable} ${bitter.variable} font-sans min-h-screen bg-background text-foreground`}
      >
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
