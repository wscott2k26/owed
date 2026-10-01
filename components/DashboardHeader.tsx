"use client";
import { useRouter } from "next/navigation";
export default function DashboardHeader({ businessName, plan, sendMode }: { businessName: string; plan: string; sendMode: string }) {
  const router = useRouter();
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }
  return <header className="border-b border-hairline bg-canvas/90 sticky top-0 z-20 backdrop-blur-sm">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <div><a href="/dashboard" className="text-xl font-bold tracking-tight">Owed</a><p className="text-xs text-faint truncate max-w-[45vw]">{businessName}</p></div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline rounded-full border border-hairline px-2.5 py-1 text-xs text-muted">{plan}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sendMode === "live" ? "bg-success/15 text-success" : "bg-amber-dim text-amber"}`}>{sendMode === "live" ? "Live sends" : "Simulation"}</span>
        <button onClick={logout} className="btn-secondary py-1.5">Sign out</button>
      </div>
    </div>
  </header>;
}
