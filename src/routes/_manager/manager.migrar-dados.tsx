import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
// Papa é carregado dinamicamente dentro do handler (~50KB economizados no bundle inicial)
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, Loader2,
  Database, ArrowRight, AlertTriangle, FileUp, Users, Home, FileText,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { onlyDigits } from "@/lib/br-validators";

export const Route = createFileRoute("/_manager/manager/migrar-dados")({
  head: () => ({ meta: [{ title: "Migrar Dados — NEXO" }] }),
  component: MigrarDadosPage,
});

// ---------------- Templates (3 planilhas separadas) ----------------

const OWNER_HEADERS = [
  "proprietario_cpf_cnpj",
  "proprietario_nome",
  "proprietario_email",
  "proprietario_telefone",
] as const;
const OWNER_REQUIRED = ["proprietario_cpf_cnpj", "proprietario_nome"] as const;

const PROPERTY_HEADERS = [
  "imovel_codigo",
  "proprietario_cpf_cnpj",
  "imovel_endereco",
  "imovel_tipo",
  "imovel_valor_aluguel",
  "imovel_status",
] as const;
const PROPERTY_REQUIRED = ["imovel_codigo", "imovel_endereco"] as const;

const CONTRACT_HEADERS = [
  "imovel_codigo",
  "inquilino_cpf",
  "inquilino_nome",
  "inquilino_email",
  "inquilino_telefone",
  "contrato_valor",
  "contrato_vencimento",
  "contrato_duracao_meses",
  "contrato_ativo",
] as const;
const CONTRACT_REQUIRED = [
  "imovel_codigo", "inquilino_nome", "contrato_valor", "contrato_vencimento",
] as const;

type OwnerRow = Record<(typeof OWNER_HEADERS)[number], string>;
type PropertyRow = Record<(typeof PROPERTY_HEADERS)[number], string>;
type ContractRow = Record<(typeof CONTRACT_HEADERS)[number], string>;

type Origem = "proprietarios" | "imoveis" | "contratos";
type RowError = { origem: Origem; line: number; reason: string };

// ---------------- Helpers de parse ----------------

function parseBool(raw: string | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return true;
  return ["1", "true", "sim", "s", "yes", "y", "ativo", "ativa"].includes(s);
}
function parseBRDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
function parseMoney(raw: string): number {
  if (!raw) return NaN;
  const cleaned = String(raw)
    .replace(/[R$\s]/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, headers: readonly string[], sampleRows: string[][]) {
  const lines = [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const TEMPLATES = {
  proprietarios: () =>
    downloadCsv("nexo_1_proprietarios.csv", OWNER_HEADERS, [
      ["123.456.789-09", "Maria Souza", "maria@exemplo.com", "(11) 98888-7777"],
      ["555.444.333-22", "Carlos Lima", "carlos@exemplo.com", "(21) 97777-5555"],
    ]),
  imoveis: () =>
    downloadCsv("nexo_2_imoveis.csv", PROPERTY_HEADERS, [
      ["AP-001", "123.456.789-09", "Rua das Flores 123 - Centro", "apartamento", "1500.00", "disponivel"],
      ["CS-002", "555.444.333-22", "Av Brasil 4500 ap 302", "casa", "2300.50", "alugado"],
    ]),
  contratos: () =>
    downloadCsv("nexo_3_contratos.csv", CONTRACT_HEADERS, [
      ["AP-001", "987.654.321-00", "João Pereira", "joao@exemplo.com", "(11) 97777-6666", "1500.00", "2026-07-10", "12", "sim"],
      ["CS-002", "111.222.333-44", "Ana Ribeiro", "", "", "2300.50", "2026-08-05", "30", "sim"],
    ]),
};

// ---------------- Componente ----------------

type SlotState<T> = {
  file: File | null;
  rows: T[];
  status: "vazio" | "pronto" | "importando" | "ok" | "erro";
  ok: number;
  errors: number;
};

const emptySlot = <T,>(): SlotState<T> => ({
  file: null, rows: [], status: "vazio", ok: 0, errors: 0,
});

function MigrarDadosPage() {
  const navigate = useNavigate();
  const [owners, setOwners] = useState<SlotState<OwnerRow>>(emptySlot<OwnerRow>());
  const [props, setProps] = useState<SlotState<PropertyRow>>(emptySlot<PropertyRow>());
  const [contracts, setContracts] = useState<SlotState<ContractRow>>(emptySlot<ContractRow>());

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [totalOk, setTotalOk] = useState(0);

  function reset() {
    setOwners(emptySlot<OwnerRow>());
    setProps(emptySlot<PropertyRow>());
    setContracts(emptySlot<ContractRow>());
    setErrors([]); setTotalOk(0); setFinished(false); setRunning(false);
  }

  async function parseFile<T>(
    f: File,
    required: readonly string[],
    setSlot: (s: SlotState<T>) => void,
  ) {
    const { default: Papa } = await import("papaparse");
    Papa.parse<T>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result: { data: T[]; meta: { fields?: string[] } }) => {
        const missing = required.filter((h) => !result.meta.fields?.includes(h));
        if (missing.length > 0) {
          toast.error(`Cabeçalhos ausentes em ${f.name}: ${missing.join(", ")}`);
          setSlot({ file: f, rows: [], status: "erro", ok: 0, errors: 0 });
          return;
        }
        setSlot({ file: f, rows: result.data, status: "pronto", ok: 0, errors: 0 });
        toast.success(`${f.name}: ${result.data.length} linha(s) lida(s).`);
      },
      error: (err: { message: string }) => toast.error(`Erro ao ler ${f.name}: ${err.message}`),
    });
  }

  async function processImport() {
    if (running) return;
    if (owners.rows.length === 0 && props.rows.length === 0 && contracts.rows.length === 0) {
      toast.error("Carregue pelo menos uma planilha para iniciar.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) { toast.error("Sessão expirada. Faça login novamente."); return; }

    setRunning(true); setFinished(false);
    const allErrors: RowError[] = [];
    let okSum = 0;

    // -------- 1) PROPRIETÁRIOS (cache em memória por CPF/CNPJ) --------
    const ownerCache = new Map<string, { name: string; doc: string }>();
    if (owners.rows.length > 0) {
      setOwners((s) => ({ ...s, status: "importando" }));
      let ok = 0; let er = 0;
      for (let i = 0; i < owners.rows.length; i++) {
        const r = owners.rows[i];
        const line = i + 2;
        try {
          const doc = onlyDigits(r.proprietario_cpf_cnpj ?? "");
          const name = (r.proprietario_nome ?? "").trim();
          if (!doc) throw new Error("proprietario_cpf_cnpj vazio");
          if (!name) throw new Error("proprietario_nome vazio");
          ownerCache.set(doc, { name, doc });
          ok++;
        } catch (err: any) {
          allErrors.push({ origem: "proprietarios", line, reason: err?.message ?? String(err) });
          er++;
        }
      }
      okSum += ok;
      setOwners((s) => ({ ...s, status: er > 0 && ok === 0 ? "erro" : "ok", ok, errors: er }));
    }

    // -------- 2) IMÓVEIS (resolve proprietário; salva owner_name + doc em notes) --------
    const propertyByCode = new Map<string, string>(); // imovel_codigo → property.id
    if (props.rows.length > 0) {
      setProps((s) => ({ ...s, status: "importando" }));
      let ok = 0; let er = 0;
      for (let i = 0; i < props.rows.length; i++) {
        const r = props.rows[i];
        const line = i + 2;
        try {
          const code = (r.imovel_codigo ?? "").trim();
          const address = (r.imovel_endereco ?? "").trim();
          if (!code) throw new Error("imovel_codigo vazio");
          if (!address) throw new Error("imovel_endereco vazio");
          const tipo = (r.imovel_tipo ?? "apartamento").trim() || "apartamento";
          const rent = parseMoney(r.imovel_valor_aluguel || "0");
          const status = (r.imovel_status ?? "disponivel").trim() || "disponivel";
          const ownerDoc = onlyDigits(r.proprietario_cpf_cnpj ?? "");
          const owner = ownerDoc ? ownerCache.get(ownerDoc) : null;

          // Dedup por code/user_id
          const { data: existing } = await supabase
            .from("properties").select("id").eq("user_id", userId).eq("code", code).maybeSingle();

          let propertyId: string;
          if (existing?.id) {
            propertyId = existing.id;
          } else {
            const allowedTypes = ["apartamento", "casa", "comercial", "terreno", "outro"] as const;
            const allowedStatus = ["disponivel", "alugado", "manutencao"] as const;
            const safeType = (allowedTypes as readonly string[]).includes(tipo)
              ? (tipo as typeof allowedTypes[number]) : "apartamento";
            const safeStatus = (allowedStatus as readonly string[]).includes(status)
              ? (status as typeof allowedStatus[number]) : "disponivel";
            const { data: insP, error: eP } = await supabase
              .from("properties").insert({
                user_id: userId,
                code,
                nickname: address.slice(0, 60),
                address,
                type: safeType,
                status: safeStatus,
                rent_price: Number.isFinite(rent) ? rent : 0,
                owner_name: owner?.name ?? null,
                notes: ownerDoc ? `CPF/CNPJ proprietário: ${ownerDoc}` : null,
              }).select("id").single();
            if (eP) throw new Error(`property: ${eP.message}`);
            propertyId = insP!.id;
          }
          propertyByCode.set(code, propertyId);
          ok++;
        } catch (err: any) {
          allErrors.push({ origem: "imoveis", line, reason: err?.message ?? String(err) });
          er++;
        }
      }
      okSum += ok;
      setProps((s) => ({ ...s, status: er > 0 && ok === 0 ? "erro" : "ok", ok, errors: er }));
    }

    // -------- 3) CONTRATOS + INQUILINO --------
    if (contracts.rows.length > 0) {
      setContracts((s) => ({ ...s, status: "importando" }));
      let ok = 0; let er = 0;
      for (let i = 0; i < contracts.rows.length; i++) {
        const r = contracts.rows[i];
        const line = i + 2;
        try {
          const code = (r.imovel_codigo ?? "").trim();
          const tenantName = (r.inquilino_nome ?? "").trim();
          const tenantDoc = onlyDigits(r.inquilino_cpf ?? "");
          const rent = parseMoney(r.contrato_valor);
          const dueIso = parseBRDate(r.contrato_vencimento);
          const months = Math.max(1, Number(r.contrato_duracao_meses) || 12);
          const isActive = parseBool(r.contrato_ativo);

          if (!code) throw new Error("imovel_codigo vazio");
          if (!tenantName) throw new Error("inquilino_nome vazio");
          if (!Number.isFinite(rent) || rent <= 0) throw new Error(`contrato_valor inválido: "${r.contrato_valor}"`);
          if (!dueIso) throw new Error(`contrato_vencimento inválido: "${r.contrato_vencimento}"`);

          // Resolve property: cache → busca por code no banco
          let propertyId = propertyByCode.get(code);
          if (!propertyId) {
            const { data: p } = await supabase
              .from("properties").select("id").eq("user_id", userId).eq("code", code).maybeSingle();
            if (!p?.id) throw new Error(`imovel_codigo "${code}" não encontrado. Importe a planilha de imóveis primeiro.`);
            propertyId = p.id;
            propertyByCode.set(code, propertyId);
          }

          // Upsert tenant por documento
          let tenantId: string | null = null;
          if (tenantDoc) {
            const { data: t } = await supabase
              .from("tenants").select("id").eq("user_id", userId).eq("document", tenantDoc).maybeSingle();
            if (t?.id) tenantId = t.id;
          }
          if (!tenantId) {
            const { data: insT, error: eT } = await supabase
              .from("tenants").insert({
                user_id: userId,
                full_name: tenantName,
                document: tenantDoc || null,
                email: (r.inquilino_email ?? "").trim() || null,
                phone: (r.inquilino_telefone ?? "").trim() || null,
              }).select("id").single();
            if (eT) throw new Error(`tenant: ${eT.message}`);
            tenantId = insT!.id;
          }

          const dueDay = Number(dueIso.slice(8, 10));
          const { error: eC } = await supabase.from("contracts").insert({
            user_id: userId,
            property_id: propertyId,
            tenant_id: tenantId,
            start_date: dueIso,
            end_date: addMonths(dueIso, months),
            due_day: dueDay,
            rent_amount: rent,
            readjustment_index: "IGP-M",
            security_deposit: 0,
            active: isActive,
          });
          if (eC) throw new Error(`contract: ${eC.message}`);
          ok++;
        } catch (err: any) {
          allErrors.push({ origem: "contratos", line, reason: err?.message ?? String(err) });
          er++;
        }
      }
      okSum += ok;
      setContracts((s) => ({ ...s, status: er > 0 && ok === 0 ? "erro" : "ok", ok, errors: er }));
    }

    setErrors(allErrors);
    setTotalOk(okSum);
    setRunning(false);
    setFinished(true);
    toast.success(`Importação concluída! ${okSum} registros inseridos. ${allErrors.length} falhas.`, { duration: 8000 });
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400 mb-2">
          <Database className="size-3.5" /> Admin
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Migrar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Importe a sua imobiliária em 3 planilhas organizadas: proprietários, imóveis e contratos.
          Pode carregar apenas as etapas que precisar (ex.: só contratos se os imóveis já existem na conta).
        </p>
      </header>

      <SlotCard<OwnerRow>
        step={1}
        icon={<Users className="size-5" />}
        tone="violet"
        title="Proprietários"
        subtitle="Cadastro base dos donos dos imóveis. Chave única: CPF/CNPJ."
        headers={OWNER_HEADERS}
        slot={owners}
        onTemplate={TEMPLATES.proprietarios}
        onFile={(f) => parseFile<OwnerRow>(f, OWNER_REQUIRED, setOwners)}
        onClear={() => setOwners(emptySlot<OwnerRow>())}
        disabled={running}
      />

      <SlotCard<PropertyRow>
        step={2}
        icon={<Home className="size-5" />}
        tone="fuchsia"
        title="Imóveis"
        subtitle="Cada imóvel referencia um proprietário pelo CPF/CNPJ. O imovel_codigo será usado pelos contratos."
        headers={PROPERTY_HEADERS}
        slot={props}
        onTemplate={TEMPLATES.imoveis}
        onFile={(f) => parseFile<PropertyRow>(f, PROPERTY_REQUIRED, setProps)}
        onClear={() => setProps(emptySlot<PropertyRow>())}
        disabled={running}
      />

      <SlotCard<ContractRow>
        step={3}
        icon={<FileText className="size-5" />}
        tone="cyan"
        title="Contratos & Inquilinos"
        subtitle="Cria o inquilino e o contrato vinculado ao imovel_codigo. Parcelas são geradas automaticamente."
        headers={CONTRACT_HEADERS}
        slot={contracts}
        onTemplate={TEMPLATES.contratos}
        onFile={(f) => parseFile<ContractRow>(f, CONTRACT_REQUIRED, setContracts)}
        onClear={() => setContracts(emptySlot<ContractRow>())}
        disabled={running}
      />

      {/* Ação principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-sm text-muted-foreground">
          {owners.rows.length + props.rows.length + contracts.rows.length > 0 && !running && !finished && (
            <span>
              Pronto para processar <strong className="text-zinc-200">
                {owners.rows.length + props.rows.length + contracts.rows.length}
              </strong> registro(s) no total.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {(owners.file || props.file || contracts.file || finished) && (
            <Button variant="ghost" onClick={reset} disabled={running}>Limpar tudo</Button>
          )}
          <Button
            disabled={running || (owners.rows.length + props.rows.length + contracts.rows.length === 0)}
            onClick={processImport}
            className="bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_-6px_rgb(168_85_247)]"
          >
            {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            {running ? "Processando…" : "Iniciar importação completa"}
          </Button>
        </div>
      </div>

      {/* Erros consolidados */}
      {errors.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/[0.05]">
          <div className="px-4 py-2.5 flex items-center gap-2 text-rose-300 text-sm border-b border-rose-500/20">
            <AlertTriangle className="size-4" />
            <span className="font-medium">{errors.length} linha(s) com erro</span>
          </div>
          <ScrollArea className="max-h-64">
            <ul className="divide-y divide-rose-500/10 text-sm">
              {errors.map((e, i) => (
                <li key={i} className="px-4 py-2 flex items-start gap-3">
                  <Badge variant="outline" className="border-rose-500/40 text-rose-300 capitalize">
                    {e.origem}
                  </Badge>
                  <span className="text-rose-400 font-mono text-xs mt-0.5">Linha {e.line}</span>
                  <span className="text-muted-foreground flex-1">— {e.reason}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Card>
      )}

      {/* Modal conclusão */}
      <Dialog open={finished} onOpenChange={(o) => !o && setFinished(false)}>
        <DialogContent className="border-violet-500/30">
          <DialogHeader>
            <div className="size-12 rounded-full bg-emerald-500/15 text-emerald-400 grid place-items-center mb-2 ring-1 ring-emerald-500/40">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle>Importação concluída!</DialogTitle>
            <DialogDescription>
              <span className="text-emerald-400 font-semibold">{totalOk}</span> registros inseridos com sucesso.{" "}
              <span className="text-rose-400 font-semibold">{errors.length}</span> falhas detectadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setFinished(false)}>Fechar</Button>
            <Button
              className="bg-violet-500 hover:bg-violet-400 text-white"
              onClick={() => navigate({ to: "/manager/carteira" })}
            >
              Ver Contratos <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- SlotCard ----------------

const TONES = {
  violet: {
    text: "text-violet-300", bg: "bg-violet-500/10", ring: "ring-violet-500/40",
    border: "border-violet-500/30", glow: "shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]",
    btn: "border-violet-500/40 text-violet-300 hover:bg-violet-500/10",
  },
  fuchsia: {
    text: "text-fuchsia-300", bg: "bg-fuchsia-500/10", ring: "ring-fuchsia-500/40",
    border: "border-fuchsia-500/30", glow: "shadow-[0_0_30px_-10px_rgba(217,70,239,0.5)]",
    btn: "border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/10",
  },
  cyan: {
    text: "text-cyan-300", bg: "bg-cyan-500/10", ring: "ring-cyan-500/40",
    border: "border-cyan-500/30", glow: "shadow-[0_0_30px_-10px_rgba(34,211,238,0.5)]",
    btn: "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10",
  },
} as const;

function SlotCard<T>({
  step, icon, tone, title, subtitle, headers, slot,
  onTemplate, onFile, onClear, disabled,
}: {
  step: number;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  title: string;
  subtitle: string;
  headers: readonly string[];
  slot: SlotState<T>;
  onTemplate: () => void;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const t = TONES[tone];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!/\.csv$/i.test(f.name)) { toast.error("Selecione um arquivo .csv válido."); return; }
    onFile(f);
  }, [onFile]);

  return (
    <Card className={cn("p-5 space-y-4", t.border)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("size-11 rounded-xl grid place-items-center ring-1", t.bg, t.text, t.ring)}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] tracking-wider", t.btn)}>
                PASSO {step}
              </Badge>
              <h2 className="text-lg font-semibold">{title}</h2>
              <SlotStatusBadge slot={slot} tone={tone} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono">
              Colunas: {headers.join(", ")}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onTemplate} className={t.btn}>
          <Download className="size-3.5 mr-1.5" />
          Baixar modelo
        </Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "rounded-lg border-2 border-dashed transition-all cursor-pointer bg-zinc-950/40 py-8 px-4 text-center",
          dragOver ? cn(t.border, t.glow) : "border-zinc-800 hover:border-zinc-700",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <input
          ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {slot.file ? (
          <div className="flex flex-col items-center gap-1">
            <FileUp className={cn("size-6", t.text)} />
            <p className="font-medium text-zinc-100 text-sm">{slot.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {slot.rows.length} linha(s) válida(s) detectada(s)
            </p>
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              disabled={disabled}
              className="mt-1 h-7 text-xs text-muted-foreground hover:text-rose-400"
            >
              Remover arquivo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <FileSpreadsheet className="size-6 text-zinc-500" />
            <p className="text-sm text-zinc-300">Arraste o CSV ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">Apenas .csv</p>
          </div>
        )}
      </div>

      {slot.status === "importando" && (
        <Progress
          value={undefined}
          className="h-1.5 bg-zinc-900 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500"
        />
      )}
      {(slot.status === "ok" || slot.status === "erro") && (slot.ok + slot.errors > 0) && (
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="size-3.5" /> {slot.ok} ok
          </span>
          {slot.errors > 0 && (
            <span className="text-rose-400 inline-flex items-center gap-1">
              <XCircle className="size-3.5" /> {slot.errors} erro(s)
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function SlotStatusBadge<T>({ slot, tone }: { slot: SlotState<T>; tone: keyof typeof TONES }) {
  if (slot.status === "vazio") return null;
  const map: Record<SlotState<T>["status"], { label: string; className: string }> = {
    vazio: { label: "", className: "" },
    pronto: { label: "Pronto", className: "border-zinc-700 text-zinc-300" },
    importando: { label: "Importando…", className: "border-violet-500/40 text-violet-300 animate-pulse" },
    ok: { label: "Importado ✓", className: "border-emerald-500/40 text-emerald-300" },
    erro: { label: "Falha", className: "border-rose-500/40 text-rose-300" },
  };
  const cfg = map[slot.status];
  return <Badge variant="outline" className={cn("text-[10px]", cfg.className)}>{cfg.label}</Badge>;
}
