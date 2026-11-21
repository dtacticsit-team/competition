import type { ReactNode } from "react";
import { KolamMark } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="kolam-dots">
      <div className="page flex min-h-[72vh] items-center justify-center py-10">
        <div className="card rise-in w-full max-w-md p-6 sm:p-8">
          <KolamMark className="mx-auto h-11 w-11 text-saffron" />
          {children}
        </div>
      </div>
    </div>
  );
}
