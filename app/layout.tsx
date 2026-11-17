import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Gated support agent", description: "Kestrel Pay support desk with a permission gate" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <span className="brand">Kestrel Pay support</span>
          <nav>
            <Link href="/">Inbox</Link>
            <Link href="/eval">Eval</Link>
          </nav>
          <span className="tag">Made-up company. Synthetic data.</span>
        </header>
        {children}
      </body>
    </html>
  );
}
