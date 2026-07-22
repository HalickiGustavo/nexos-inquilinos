import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { LayoutDashboard, Wallet, Coins, Wrench, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { URBANIST } from "./ui";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/landlord", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/landlord/financeiro", label: "Finanças", icon: Wallet },
  { to: "/landlord/saldo", label: "Saldo & Saque", icon: Coins },
  { to: "/landlord/manutencoes", label: "Manutenções", icon: Wrench },
];

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/landlord": {
    title: "Dashboard",
    subtitle: "Bem-vindo, acompanhe o desempenho do seu portfólio.",
  },
  "/landlord/financeiro": {
    title: "Finanças",
    subtitle: "Histórico de parcelas e repasses dos seus imóveis.",
  },
  "/landlord/saldo": {
    title: "Saldo & Saque",
    subtitle: "Saldo disponível e solicitação de repasse via PIX.",
  },
  "/landlord/manutencoes": {
    title: "Manutenções",
    subtitle: "Acompanhe os chamados abertos nos seus imóveis.",
  },
};

function isActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to || pathname === `${to}/`;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function LandlordShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const header = useMemo(() => {
    // match nested paths back to their top-level entry
    const key = Object.keys(TITLES).find((k) => isActive(pathname, k, k === "/landlord"));
    return TITLES[key ?? "/landlord"];
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div
      className="landlord-theme flex min-h-screen w-full text-[#f8fafc]"
      style={{ backgroundColor: "#0a0a1a", fontFamily: "Epilogue, ui-sans-serif, system-ui" }}
    >
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-[#1e1e5a] bg-[#141432]">
        <SidebarBody email={user?.email ?? ""} pathname={pathname} onSignOut={handleSignOut} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#1e1e5a] bg-[#141432] md:hidden">
            <button
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:text-white"
            >
              <X className="size-5" />
            </button>
            <SidebarBody
              email={user?.email ?? ""}
              pathname={pathname}
              onSignOut={handleSignOut}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-gradient-to-br from-[#0a0a1a] via-[#0d0d26] to-[#0a0a1a]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#1e1e5a]/50 bg-[#0a0a1a]/70 px-5 backdrop-blur-xl md:h-24 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-lg border border-[#1e1e5a] p-2 text-slate-300 hover:text-white md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <h1
                className="truncate text-xl font-extrabold tracking-tight text-white md:text-2xl"
                style={URBANIST}
              >
                {header.title}
              </h1>
              <p className="truncate text-xs text-slate-400 md:text-sm">{header.subtitle}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-[#1e1e5a] bg-[#141432] px-4 py-2 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-xs font-semibold text-slate-300">Sincronizado</span>
          </div>
        </header>

        <div className="p-5 md:p-10">{children}</div>
      </main>

      <SupportWhatsAppButton />
    </div>
  );
}

function SidebarBody({
  email,
  pathname,
  onSignOut,
  onNavigate,
}: {
  email: string;
  pathname: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  const initial = (email?.[0] ?? "P").toUpperCase();
  return (
    <>
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f46e5] shadow-lg shadow-[#4f46e5]/40">
            <div className="h-5 w-5 rotate-45 rounded-sm border-2 border-white" />
          </div>
          <span
            className="text-2xl font-extrabold tracking-tight text-white"
            style={URBANIST}
          >
            NEXO
          </span>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1.5 px-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.to, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={
                active
                  ? "flex items-center gap-3 rounded-xl border border-[#4f46e5]/30 bg-[#4f46e5]/10 px-4 py-3.5 text-[#a5b4fc]"
                  : "flex items-center gap-3 rounded-xl px-4 py-3.5 text-slate-400 transition-all hover:bg-[#1e1e5a]/50 hover:text-white"
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className={active ? "font-semibold" : ""}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[#1e1e5a] bg-[#0a0a1a] p-4">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#1e1e5a] bg-[#1e1e5a] text-[#a5b4fc] font-bold"
            style={URBANIST}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-bold text-white"
              style={URBANIST}
            >
              {email || "Proprietário"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Proprietário
            </p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-[#1e1e5a]/50 hover:text-white"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </>
  );
}
