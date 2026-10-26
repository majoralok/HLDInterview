import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScaleSketch — Draw. Reason. Design at scale.",
  description:
    "Practice system design with a visual architecture canvas, traffic and failure experiments, guided interviews, and evidence-based AI reviews.",
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
