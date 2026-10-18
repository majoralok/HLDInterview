import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Architect Lab — System Design Practice",
  description:
    "A local-first system design interview studio with guided practice, progress tracking, and AI coaching.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
