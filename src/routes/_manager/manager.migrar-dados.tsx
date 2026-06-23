import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, Loader2,
  Database, ArrowRight, AlertTriangle, FileUp, Sparkles,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { onlyDigits } from "@/lib/br-validators";


export const Route = createFileRoute("/_manager/manager/migrar-dados")({
  head: () => ({ meta: [{ title: "Migrar Dados — NEXO" }] }),
  component: MigrarDadosPage,
});

// ---------------- Modelo único e unificado ----------------
// Uma única planilha com todas as colunas. Cada linha = 1 contrato completo
// (proprietário + imóvel + inquilino + contrato). Campos vazios são ignorados
// — o sistema cria apenas o que estiver preenchido. Linhas com o mesmo
// CPF/CNPJ ou imovel_codigo reaproveitam os registros já criados.

const HEADERS = [
  // Proprietário
  "proprietario_cpf_cnpj",
  "proprietario_nome",
  "proprietario_email",
  "proprietario_telefone",
  // Imóvel
  "imovel_codigo",
  "imovel_endereco",
  "imovel_tipo",
  "imovel_valor_aluguel",
  "imovel_status",
  // Inquilino
  "inquilino_cpf",
  "inquilino_nome",
  "inquilino_email",
  "inquilino_telefone",
  // Contrato
  "contrato_valor",
  "contrato_vencimento",
  "contrato_duracao_meses",
  "contrato_ativo",
] as const;

type Row = Record<(typeof HEADERS)[number], string>;
type RowError = { line: number; reason: string };

// ---------------- Helpers ----------------

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

function downloadTemplate() {
  downloadCsv("nexo_migracao_imobiliaria.csv", HEADERS, [
    [
      "123.456.789-09", "Maria Souza", "maria@exemplo.com", "(11) 98888-7777",
      "AP-001", "Rua das Flores 123 - Centro", "apartamento", "1500.00", "alugado",
      "987.654.321-00", "João Pereira", "joao@exemplo.com", "(11) 97777-6666",
      "1500.00", "10/07/2026", "12", "sim",
    ],
    [
      "555.444.333-22", "Carlos Lima", "carlos@exemplo.com", "(21) 97777-5555",
      "CS-002", "Av Brasil 4500 ap 302", "casa", "2300.50", "alugado",
      "111.222.333-44", "Ana Ribeiro", "", "",
      "2300.50", "05/08/2026", "30", "sim",
    ],
    // Linha só de imóvel (sem inquilino/contrato) — basta deixar em branco
    [
      "555.444.333-22", "Carlos Lima", "", "",
      "AP-003", "Rua Verde 88", "apartamento", "1800.00", "disponivel",
      "", "", "", "",
      "", "", "", "",
    ],
  ]);
}

// ---------------- Modelos separados (3 planilhas) ----------------

const OWNERS_HEADERS = [
  "proprietario_cpf_cnpj", "proprietario_nome", "proprietario_email", "proprietario_telefone",
] as const;
const PROPS_HEADERS = [
  "imovel_codigo", "proprietario_cpf_cnpj",
  "imovel_endereco", "imovel_tipo", "imovel_valor_aluguel", "imovel_status",
] as const;
const CONTRACTS_HEADERS = [
  "imovel_codigo", "inquilino_cpf", "inquilino_nome", "inquilino_email", "inquilino_telefone",
  "contrato_valor", "contrato_vencimento", "contrato_duracao_meses", "contrato_ativo",
] as const;

function downloadTemplateOwners() {
  downloadCsv("nexo_proprietarios.csv", OWNERS_HEADERS, [
    ["123.456.789-09", "Maria Souza", "maria@exemplo.com", "(11) 98888-7777"],
    ["555.444.333-22", "Carlos Lima", "carlos@exemplo.com", "(21) 97777-5555"],
  ]);
}
function downloadTemplateProperties() {
  downloadCsv("nexo_imoveis.csv", PROPS_HEADERS, [
    ["AP-001", "123.456.789-09", "Rua das Flores 123 - Centro", "apartamento", "1500.00", "alugado"],
    ["AP-003", "555.444.333-22", "Rua Verde 88", "apartamento", "1800.00", "disponivel"],
  ]);
}
function downloadTemplateContracts() {
  downloadCsv("nexo_contratos.csv", CONTRACTS_HEADERS, [
    ["AP-001", "987.654.321-00", "João Pereira", "joao@exemplo.com", "(11) 97777-6666",
     "1500.00", "10/07/2026", "12", "sim"],
  ]);
}

// Junta as 3 planilhas em linhas unificadas (formato Row) — assim reaproveitamos
// o pipeline da planilha única.
function mergeSeparateSheets(
  owners: Record<string, string>[],
  props: Record<string, string>[],
  contracts: Record<string, string>[],
): Row[] {
  const ownerByDoc = new Map<string, Record<string, string>>();
  for (const o of owners) {
    const k = onlyDigits(o.proprietario_cpf_cnpj ?? "");
    if (k) ownerByDoc.set(k, o);
  }
  const propByCode = new Map<string, Record<string, string>>();
  for (const p of props) {
    const k = (p.imovel_codigo ?? "").trim();
    if (k) propByCode.set(k, p);
  }

  const out: Row[] = [];
  const usedPropCodes = new Set<string>();

  // Uma linha por contrato (carrega imóvel + proprietário)
  for (const c of contracts) {
    const code = (c.imovel_codigo ?? "").trim();
    const p = code ? propByCode.get(code) : undefined;
    const ownerDoc = onlyDigits(p?.proprietario_cpf_cnpj ?? "");
    const o = ownerDoc ? ownerByDoc.get(ownerDoc) : undefined;
    if (code) usedPropCodes.add(code);
    out.push({
      proprietario_cpf_cnpj: o?.proprietario_cpf_cnpj ?? p?.proprietario_cpf_cnpj ?? "",
      proprietario_nome: o?.proprietario_nome ?? "",
      proprietario_email: o?.proprietario_email ?? "",
      proprietario_telefone: o?.proprietario_telefone ?? "",
      imovel_codigo: code,
      imovel_endereco: p?.imovel_endereco ?? "",
      imovel_tipo: p?.imovel_tipo ?? "",
      imovel_valor_aluguel: p?.imovel_valor_aluguel ?? "",
      imovel_status: p?.imovel_status ?? "",
      inquilino_cpf: c.inquilino_cpf ?? "",
      inquilino_nome: c.inquilino_nome ?? "",
      inquilino_email: c.inquilino_email ?? "",
      inquilino_telefone: c.inquilino_telefone ?? "",
      contrato_valor: c.contrato_valor ?? "",
      contrato_vencimento: c.contrato_vencimento ?? "",
      contrato_duracao_meses: c.contrato_duracao_meses ?? "",
      contrato_ativo: c.contrato_ativo ?? "",
    });
  }

  // Imóveis sem contrato — também criamos (carregando o proprietário)
  for (const [code, p] of propByCode) {
    if (usedPropCodes.has(code)) continue;
    const ownerDoc = onlyDigits(p.proprietario_cpf_cnpj ?? "");
    const o = ownerDoc ? ownerByDoc.get(ownerDoc) : undefined;
    out.push({
      proprietario_cpf_cnpj: o?.proprietario_cpf_cnpj ?? p.proprietario_cpf_cnpj ?? "",
      proprietario_nome: o?.proprietario_nome ?? "",
      proprietario_email: o?.proprietario_email ?? "",
      proprietario_telefone: o?.proprietario_telefone ?? "",
      imovel_codigo: code,
      imovel_endereco: p.imovel_endereco ?? "",
      imovel_tipo: p.imovel_tipo ?? "",
      imovel_valor_aluguel: p.imovel_valor_aluguel ?? "",
      imovel_status: p.imovel_status ?? "",
      inquilino_cpf: "", inquilino_nome: "", inquilino_email: "", inquilino_telefone: "",
      contrato_valor: "", contrato_vencimento: "", contrato_duracao_meses: "", contrato_ativo: "",
    });
  }

  // Proprietários sem imóvel — uma linha só com o proprietário
  for (const [doc, o] of ownerByDoc) {
    const hasProp = [...propByCode.values()].some(
      (p) => onlyDigits(p.proprietario_cpf_cnpj ?? "") === doc,
    );
    if (hasProp) continue;
    out.push({
      proprietario_cpf_cnpj: o.proprietario_cpf_cnpj ?? "",
      proprietario_nome: o.proprietario_nome ?? "",
      proprietario_email: o.proprietario_email ?? "",
      proprietario_telefone: o.proprietario_telefone ?? "",
      imovel_codigo: "", imovel_endereco: "", imovel_tipo: "", imovel_valor_aluguel: "", imovel_status: "",
      inquilino_cpf: "", inquilino_nome: "", inquilino_email: "", inquilino_telefone: "",
      contrato_valor: "", contrato_vencimento: "", contrato_duracao_meses: "", contrato_ativo: "",
    });
  }

  return out;
}

// ---------------- Componente ----------------


function MigrarDadosPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [counts, setCounts] = useState({
    owners: 0, properties: 0, tenants: 0, contracts: 0,
  });

  // Estado das 3 planilhas separadas
  const [ownersFile, setOwnersFile] = useState<File | null>(null);
  const [ownersRows, setOwnersRows] = useState<Record<string, string>[]>([]);
  const [propsFile, setPropsFile] = useState<File | null>(null);
  const [propsRows, setPropsRows] = useState<Record<string, string>[]>([]);
  const [contractsFile, setContractsFile] = useState<File | null>(null);
  const [contractsRows, setContractsRows] = useState<Record<string, string>[]>([]);

  function reset() {
    setFile(null); setRows([]); setErrors([]); setFinished(false);
    setRunning(false); setProgress(0);
    setCounts({ owners: 0, properties: 0, tenants: 0, contracts: 0 });
    setOwnersFile(null); setOwnersRows([]);
    setPropsFile(null); setPropsRows([]);
    setContractsFile(null); setContractsRows([]);
  }

  async function parseCsvFile<T extends Record<string, string>>(
    f: File,
    onDone: (rows: T[]) => void,
  ) {
    if (!/\.csv$/i.test(f.name)) { toast.error("Selecione um arquivo .csv válido."); return; }
    const { default: Papa } = await import("papaparse");
    Papa.parse<T>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        onDone(result.data);
        toast.success(`${f.name}: ${result.data.length} linha(s) lida(s).`);
      },
      error: (err) => toast.error(`Erro ao ler ${f.name}: ${err.message}`),
    });
  }

  function mergeAndPrepare() {
    if (!ownersRows.length && !propsRows.length && !contractsRows.length) {
      toast.error("Carregue pelo menos uma das 3 planilhas.");
      return;
    }
    const merged = mergeSeparateSheets(ownersRows, propsRows, contractsRows);
    setRows(merged);
    toast.success(`${merged.length} linha(s) prontas para importar.`);
  }

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!/\.csv$/i.test(f.name)) { toast.error("Selecione um arquivo .csv válido."); return; }
    const { default: Papa } = await import("papaparse");
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        setFile(f);
        setRows(result.data);
        toast.success(`${f.name}: ${result.data.length} linha(s) lida(s).`);
      },
      error: (err) => toast.error(`Erro ao ler ${f.name}: ${err.message}`),
    });
  }, []);

  async function processImport() {
    if (running || rows.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) { toast.error("Sessão expirada. Faça login novamente."); return; }

    setRunning(true); setFinished(false); setProgress(0);
    const allErrors: RowError[] = [];

    // Caches para deduplicar dentro da mesma planilha
    const ownerCache = new Map<string, { name: string; doc: string }>();
    const propertyByCode = new Map<string, string>();
    const tenantByDoc = new Map<string, string>();
    let ownersCreated = 0, propsCreated = 0, tenantsCreated = 0, contractsCreated = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = i + 2;
      try {
        // ---- Proprietário (opcional) ----
        const ownerDoc = onlyDigits(r.proprietario_cpf_cnpj ?? "");
        const ownerName = (r.proprietario_nome ?? "").trim();
        if (ownerDoc && ownerName && !ownerCache.has(ownerDoc)) {
          ownerCache.set(ownerDoc, { name: ownerName, doc: ownerDoc });
          ownersCreated++;
        }
        const owner = ownerDoc ? ownerCache.get(ownerDoc) : null;

        // ---- Imóvel (opcional, mas necessário para contrato) ----
        const code = (r.imovel_codigo ?? "").trim();
        const address = (r.imovel_endereco ?? "").trim();
        let propertyId: string | undefined = code ? propertyByCode.get(code) : undefined;

        if (code && !propertyId) {
          // Dedup por code/user_id
          const { data: existing } = await supabase
            .from("properties").select("id").eq("user_id", userId).eq("code", code).maybeSingle();
          if (existing?.id) {
            propertyId = existing.id;
          } else {
            if (!address) throw new Error(`imovel_endereco vazio para "${code}"`);
            const tipo = (r.imovel_tipo ?? "apartamento").trim() || "apartamento";
            const status = (r.imovel_status ?? "disponivel").trim() || "disponivel";
            const rent = parseMoney(r.imovel_valor_aluguel || "0");
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
            if (eP) throw new Error(`imóvel: ${eP.message}`);
            propertyId = insP!.id;
            propsCreated++;
          }
          propertyByCode.set(code, propertyId);
        }

        // ---- Contrato + Inquilino (opcional) ----
        const tenantName = (r.inquilino_nome ?? "").trim();
        const tenantDoc = onlyDigits(r.inquilino_cpf ?? "");
        const hasContractData =
          tenantName || (r.contrato_valor ?? "").trim() || (r.contrato_vencimento ?? "").trim();

        if (hasContractData) {
          if (!propertyId) throw new Error("imovel_codigo obrigatório quando há dados de contrato/inquilino");
          if (!tenantName) throw new Error("inquilino_nome vazio");
          const rent = parseMoney(r.contrato_valor);
          const dueIso = parseBRDate(r.contrato_vencimento);
          if (!Number.isFinite(rent) || rent <= 0) throw new Error(`contrato_valor inválido: "${r.contrato_valor}"`);
          if (!dueIso) throw new Error(`contrato_vencimento inválido: "${r.contrato_vencimento}"`);
          const months = Math.max(1, Number(r.contrato_duracao_meses) || 12);
          const isActive = parseBool(r.contrato_ativo);

          // Upsert tenant
          let tenantId: string | undefined = tenantDoc ? tenantByDoc.get(tenantDoc) : undefined;
          if (!tenantId && tenantDoc) {
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
            if (eT) throw new Error(`inquilino: ${eT.message}`);
            tenantId = insT!.id;
            tenantsCreated++;
          }
          if (tenantDoc) tenantByDoc.set(tenantDoc, tenantId);

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
          if (eC) throw new Error(`contrato: ${eC.message}`);
          contractsCreated++;
        }
      } catch (err: any) {
        allErrors.push({ line, reason: err?.message ?? String(err) });
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setCounts({
      owners: ownersCreated, properties: propsCreated,
      tenants: tenantsCreated, contracts: contractsCreated,
    });
    setErrors(allErrors);
    setRunning(false);
    setFinished(true);
    const total = ownersCreated + propsCreated + tenantsCreated + contractsCreated;
    toast.success(`Importação concluída! ${total} registros criados. ${allErrors.length} falhas.`, { duration: 8000 });
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400 mb-2">
          <Database className="size-3.5" /> Admin
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Migrar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Importe toda a sua imobiliária em <strong className="text-zinc-200">uma única planilha</strong>.
          Cada linha representa um contrato completo (proprietário + imóvel + inquilino + contrato).
          Campos vazios são ignorados — você pode importar só imóveis, ou só contratos, ou tudo de uma vez.
        </p>
      </header>

      <Tabs defaultValue="unica" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="unica">Planilha única</TabsTrigger>
          <TabsTrigger value="separadas">3 planilhas separadas</TabsTrigger>
        </TabsList>

        <TabsContent value="unica" className="space-y-6 mt-4">
          {/* Card guia */}
          <Card className="p-5 border-violet-500/30 bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04]">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-xl grid place-items-center ring-1 bg-violet-500/10 text-violet-300 ring-violet-500/40">
                <Sparkles className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Planilha única — fácil de preencher</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Baixe o modelo, preencha no Excel/Google Sheets e arraste o arquivo aqui.
                  O sistema deduplica proprietários pelo CPF/CNPJ e imóveis pelo código automaticamente.
                </p>
                <div className="mt-3 grid sm:grid-cols-4 gap-2 text-[11px]">
                  <Hint label="Proprietário" cols="cpf_cnpj, nome, email, telefone" tone="violet" />
                  <Hint label="Imóvel" cols="codigo, endereco, tipo, valor_aluguel, status" tone="fuchsia" />
                  <Hint label="Inquilino" cols="cpf, nome, email, telefone" tone="cyan" />
                  <Hint label="Contrato" cols="valor, vencimento, duracao_meses, ativo" tone="emerald" />
                </div>
              </div>
              <Button
                variant="outline" size="sm" onClick={downloadTemplate}
                className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 shrink-0"
              >
                <Download className="size-3.5 mr-1.5" />
                Baixar modelo
              </Button>
            </div>
          </Card>

          {/* Dropzone */}
          <Card className="p-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => !running && inputRef.current?.click()}
              className={cn(
                "rounded-xl border-2 border-dashed transition-all cursor-pointer bg-zinc-950/40 py-14 px-4 text-center",
                dragOver
                  ? "border-violet-500/40 shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]"
                  : "border-zinc-800 hover:border-zinc-700",
                running && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-1">
                  <FileUp className="size-8 text-violet-300" />
                  <p className="font-medium text-zinc-100">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {rows.length} linha(s) detectada(s)
                  </p>
                  <Button
                    variant="ghost" size="sm"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    disabled={running}
                    className="mt-2 h-7 text-xs text-muted-foreground hover:text-rose-400"
                  >
                    Remover arquivo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="size-10 text-zinc-500" />
                  <p className="text-zinc-200 font-medium">Arraste seu CSV ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">Apenas .csv (UTF-8)</p>
                </div>
              )}
            </div>

            {running && (
              <div className="mt-4 space-y-1.5">
                <Progress
                  value={progress}
                  className="h-1.5 bg-zinc-900 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500"
                />
                <p className="text-xs text-muted-foreground text-right">{progress}%</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="separadas" className="space-y-4 mt-4">
          <Card className="p-5 border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.06] to-violet-500/[0.04]">
            <h2 className="text-lg font-semibold">3 planilhas separadas</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Suba uma planilha por entidade. As ligações são feitas por <code className="text-cyan-300">proprietario_cpf_cnpj</code> e <code className="text-cyan-300">imovel_codigo</code>.
              Você pode subir só uma, duas ou as três — clique em <strong className="text-zinc-200">Juntar e preparar</strong> para consolidar antes de importar.
            </p>
          </Card>

          <SeparateDropzone
            tone="violet"
            title="1. Proprietários"
            description="cpf_cnpj, nome, email, telefone"
            file={ownersFile}
            rowCount={ownersRows.length}
            onDownload={downloadTemplateOwners}
            onFile={(f) => { setOwnersFile(f); parseCsvFile(f, setOwnersRows); }}
            onClear={() => { setOwnersFile(null); setOwnersRows([]); }}
            disabled={running}
          />
          <SeparateDropzone
            tone="fuchsia"
            title="2. Imóveis"
            description="codigo, cpf_cnpj do proprietário, endereco, tipo, valor, status"
            file={propsFile}
            rowCount={propsRows.length}
            onDownload={downloadTemplateProperties}
            onFile={(f) => { setPropsFile(f); parseCsvFile(f, setPropsRows); }}
            onClear={() => { setPropsFile(null); setPropsRows([]); }}
            disabled={running}
          />
          <SeparateDropzone
            tone="emerald"
            title="3. Contratos / Inquilinos"
            description="imovel_codigo, cpf, nome, email, telefone, valor, vencimento, duracao, ativo"
            file={contractsFile}
            rowCount={contractsRows.length}
            onDownload={downloadTemplateContracts}
            onFile={(f) => { setContractsFile(f); parseCsvFile(f, setContractsRows); }}
            onClear={() => { setContractsFile(null); setContractsRows([]); }}
            disabled={running}
          />

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {ownersRows.length + propsRows.length + contractsRows.length > 0 && (
                <>Carregadas: <strong className="text-zinc-200">{ownersRows.length}</strong> proprietário(s), <strong className="text-zinc-200">{propsRows.length}</strong> imóvel(eis), <strong className="text-zinc-200">{contractsRows.length}</strong> contrato(s).</>
              )}
            </p>
            <Button
              variant="outline"
              onClick={mergeAndPrepare}
              disabled={running}
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            >
              <Sparkles className="size-4 mr-1.5" />
              Juntar e preparar
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ação principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {rows.length > 0 && !running && !finished && (
            <span>Pronto para processar <strong className="text-zinc-200">{rows.length}</strong> linha(s).</span>
          )}
        </div>
        <div className="flex gap-2">
          {(file || finished) && (
            <Button variant="ghost" onClick={reset} disabled={running}>Limpar</Button>
          )}
          <Button
            disabled={running || rows.length === 0}
            onClick={processImport}
            className="bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_-6px_rgb(168_85_247)]"
          >
            {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            {running ? "Processando…" : "Iniciar importação"}
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
                  <span className="text-rose-400 font-mono text-xs mt-0.5 shrink-0">Linha {e.line}</span>
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
            <DialogDescription asChild>
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <Stat label="Proprietários" value={counts.owners} tone="violet" />
                  <Stat label="Imóveis" value={counts.properties} tone="fuchsia" />
                  <Stat label="Inquilinos" value={counts.tenants} tone="cyan" />
                  <Stat label="Contratos" value={counts.contracts} tone="emerald" />
                </div>
                {errors.length > 0 && (
                  <p className="text-rose-400 text-sm flex items-center gap-1.5">
                    <XCircle className="size-4" /> {errors.length} falha(s) detectada(s).
                  </p>
                )}
              </div>
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

// ---------------- UI atoms ----------------

const TONE_MAP = {
  violet: "border-violet-500/30 bg-violet-500/[0.06] text-violet-300",
  fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/[0.06] text-fuchsia-300",
  cyan: "border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300",
  emerald: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
} as const;

function Hint({ label, cols, tone }: { label: string; cols: string; tone: keyof typeof TONE_MAP }) {
  return (
    <div className={cn("rounded-md border px-2.5 py-2", TONE_MAP[tone])}>
      <p className="font-medium text-[11px] tracking-wide uppercase">{label}</p>
      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 leading-snug">{cols}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONE_MAP }) {
  return (
    <div className={cn("rounded-md border px-2 py-2", TONE_MAP[tone])}>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
