import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin(); // every admin page and action re-checks the role on the server
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
