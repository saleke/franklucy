import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrankLucy | Commercial Operations & Management Platform",
  description: "FrankLucy retail and wholesale branch management, sales POS, inventory ledger, and audit control system.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-primary antialiased selection:bg-brand-primary selection:text-white">
        {children}
      </body>
    </html>
  );
}
