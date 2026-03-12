"use client";

import { SessionProvider } from "@/lib/session-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
