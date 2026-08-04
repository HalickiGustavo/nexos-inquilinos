import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, FileText, Building2, User, KeyRound, Inbox } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Hit = {
  id: string;
  kind: "contract" | "property" | "tenant" | "landlord" | "lead";
  title: string;
  subtitle?: string;
  to: string;
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const like = `%${term}%`;
    (async () => {
      try {
        const [props, tenants, landlords, leads, contracts] = await Promise.all([
          supabase.from("properties").select("id,nickname,address,code").or(`nickname.ilike.${like},address.ilike.${like},code.ilike.${like}`).limit(6),
          supabase.from("tenants").select("id,full_name,document,phone,email").is("deleted_at", null).or(`full_name.ilike.${like},document.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(6),
          supabase.from("landlord_invites").select("id,full_name,email,document").or(`full_name.ilike.${like},email.ilike.${like},document.ilike.${like}`).limit(6),
          supabase.from("crm_leads").select("id,name,phone,email").or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(6),
          supabase.from("contracts").select("id,property:properties(nickname,code),tenant:tenants(full_name)").is("deleted_at", null).limit(6),
        ]);
        if (ctrl.signal.aborted) return;
        const out: Hit[] = [];
        (props.data ?? []).forEach((p: any) => out.push({
          id: p.id, kind: "property", title: p.nickname || p.address, subtitle: p.code ? `Cód. ${p.code} · ${p.address}` : p.address, to: "/manager/carteira",
        }));
        (tenants.data ?? []).forEach((t: any) => out.push({
          id: t.id, kind: "tenant", title: t.full_name, subtitle: [t.document, t.phone].filter(Boolean).join(" · "), to: "/manager/inquilinos",
        }));
        (landlords.data ?? []).forEach((l: any) => out.push({
          id: l.id, kind: "landlord", title: l.full_name || l.email, subtitle: l.email, to: "/manager/proprietarios",
        }));
        (leads.data ?? []).forEach((l: any) => out.push({
          id: l.id, kind: "lead", title: l.name, subtitle: [l.phone, l.email].filter(Boolean).join(" · "), to: "/manager/leads",
        }));
        (contracts.data ?? []).forEach((c: any) => out.push({
          id: c.id, kind: "contract", title: `Contrato · ${c.tenant?.full_name ?? "—"}`, subtitle: c.property?.nickname ?? "", to: "/manager/carteira",
        }));
        setHits(out);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [q, open]);

  const iconFor = (k: Hit["kind"]) => {
    switch (k) {
      case "property": return <Building2 className="size-4 text-muted-foreground" />;
      case "tenant": return <KeyRound className="size-4 text-muted-foreground" />;
      case "landlord": return <User className="size-4 text-muted-foreground" />;
      case "lead": return <Inbox className="size-4 text-muted-foreground" />;
      case "contract": return <FileText className="size-4 text-muted-foreground" />;
    }
  };

  const groupBy = (kind: Hit["kind"]) => hits.filter((h) => h.kind === kind);
  const groups: Array<{ label: string; kind: Hit["kind"] }> = [
    { label: "Contratos", kind: "contract" },
    { label: "Imóveis", kind: "property" },
    { label: "Inquilinos", kind: "tenant" },
    { label: "Proprietários", kind: "landlord" },
    { label: "Leads", kind: "lead" },
  ];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-10 gap-2 pl-3 pr-2 text-muted-foreground hover:text-foreground w-full sm:w-80 justify-between bg-muted/30 border-muted-foreground/20"
        aria-label="Abrir pesquisa global"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          <span className="text-xs">Buscar…</span>
        </span>
        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
          {isMac ? "⌘" : "Ctrl"}+K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar contratos, imóveis, inquilinos, proprietários, leads…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground">Buscando…</div>}
          {!loading && q.trim().length >= 2 && hits.length === 0 && (
            <CommandEmpty>Nenhum resultado para “{q}”.</CommandEmpty>
          )}
          {q.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Digite pelo menos 2 caracteres. Você pode buscar por nome, CPF/CNPJ, telefone, código ou endereço.
            </div>
          )}
          {groups.map((g) => {
            const items = groupBy(g.kind);
            if (!items.length) return null;
            return (
              <CommandGroup key={g.kind} heading={g.label}>
                {items.map((h) => (
                  <CommandItem
                    key={`${h.kind}-${h.id}`}
                    value={`${h.kind}-${h.title}-${h.subtitle ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate({ to: h.to });
                    }}
                    className="flex items-center gap-3"
                  >
                    {iconFor(h.kind)}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{h.title}</div>
                      {h.subtitle && (
                        <div className="truncate text-[11px] text-muted-foreground">{h.subtitle}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
