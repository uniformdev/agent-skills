import type { ReactNode } from "react";

import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-950 antialiased">{children}</body>
    </html>
  );
}
