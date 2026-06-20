import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
// Papa é carregado dinamicamente dentro do handler (~50KB economizados no bundle inicial)
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, Loader2,
  Database, ArrowRight, AlertTriangle, FileUp,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

const TEMPLATE_HEADERS = [
  "proprietario_nome",
  "proprietario_cpf",
  "inquilino_nome",
  "inquilino_cpf",
  "imovel_endereco",
  "contrato_valor",
  "contrato_vencimento",
  "contrato_ativo",
] as const;

function parseBool(raw: string | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return true; // default ativo
  return ["1", "true", "sim", "s", "yes", "y", "ativo", "ativa"].includes(s);
}

type CsvRow = Record<(typeof TEMPLATE_HEADERS)[number], string>;

type RowError = { line: number; reason: string; raw: Record<string, string> };

function parseBRDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // dd/mm/yyyy
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // yyyy-mm-dd
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

function downloadTemplate() {
  const sample = [
    TEMPLATE_HEADERS.join(","),
    "Maria Souza,123.456.789-09,João Pereira,987.654.321-00,Rua das Flores 123 - Centro,1500.00,2026-07-10",
    "Carlos Lima,111.222.333-44,Ana Ribeiro,555.666.777-88,Av Brasil 4500 ap 302,2300.50,2026-08-05",
  ].join("\n");
  const blob = new Blob(["\uFEFF" + sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_nexo.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function MigrarDadosPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [success, setSuccess] = useState(0);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [finished, setFinished] = useState(false);

  const reset = () => {
    setFile(null); setRows([]); setRunning(false); setCurrent(0); setTotal(0);
    setSuccess(0); setErrors([]); setFinished(false);
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!/\.csv$/i.test(f.name)) {
      toast.error("Selecione um arquivo .csv válido.");
      return;
    }
    setFile(f);
    setFinished(false);
    setErrors([]);
    setSuccess(0);
    const { default: Papa } = await import("papaparse");
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result: { data: CsvRow[]; meta: { fields?: string[] } }) => {
        const missing = TEMPLATE_HEADERS.filter((h) => !result.meta.fields?.includes(h));
        if (missing.length > 0) {
          toast.error(`Cabeçalhos ausentes: ${missing.join(", ")}`);
          setRows([]);
          return;
        }
        setRows(result.data as CsvRow[]);
        setTotal(result.data.length);
        toast.success(`${result.data.length} linha(s) lida(s). Pronto para importar.`);
      },
      error: (err: { message: string }) => toast.error(`Erro ao ler CSV: ${err.message}`),
    });
  }, []);

  async function processImport() {
    if (rows.length === 0 || running) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setRunning(true);
    setFinished(false);
    setCurrent(0);
    setSuccess(0);
    setErrors([]);
    const localErrors: RowError[] = [];
    let okCount = 0;

    // SEQUENCIAL — for...of com await garante integridade referencial
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNumber = i + 2; // header é linha 1
      setCurrent(i + 1);

      try {
        const ownerName = (row.proprietario_nome ?? "").trim();
        const ownerDoc = onlyDigits(row.proprietario_cpf ?? "");
        const tenantName = (row.inquilino_nome ?? "").trim();
        const tenantDoc = onlyDigits(row.inquilino_cpf ?? "");
        const address = (row.imovel_endereco ?? "").trim();
        const rent = parseMoney(row.contrato_valor);
        const dueIso = parseBRDate(row.contrato_vencimento);

        if (!ownerName) throw new Error("proprietario_nome vazio");
        if (!tenantName) throw new Error("inquilino_nome vazio");
        if (!address) throw new Error("imovel_endereco vazio");
        if (!Number.isFinite(rent) || rent <= 0) throw new Error(`contrato_valor inválido: "${row.contrato_valor}"`);
        if (!dueIso) throw new Error(`contrato_vencimento inválido: "${row.contrato_vencimento}"`);

        // ---------- 1) TENANT (upsert por document/user_id) ----------
        let tenantId: string | null = null;
        if (tenantDoc) {
          const { data: existing } = await supabase
            .from("tenants").select("id")
            .eq("user_id", userId).eq("document", tenantDoc).maybeSingle();
          if (existing?.id) tenantId = existing.id;
        }
        if (!tenantId) {
          const { data: insT, error: eT } = await supabase
            .from("tenants").insert({
              user_id: userId,
              full_name: tenantName,
              document: tenantDoc || null,
            }).select("id").single();
          if (eT) throw new Error(`tenant: ${eT.message}`);
          tenantId = insT!.id;
        }

        // ---------- 2) PROPERTY (lookup por endereço/user_id, com owner) ----------
        let propertyId: string | null = null;
        const { data: existingProp } = await supabase
          .from("properties").select("id")
          .eq("user_id", userId).eq("address", address).maybeSingle();
        if (existingProp?.id) {
          propertyId = existingProp.id;
        } else {
          const { data: insP, error: eP } = await supabase
            .from("properties").insert({
              user_id: userId,
              nickname: address.slice(0, 60),
              address,
              type: "apartamento",
              status: "alugado",
              rent_price: rent,
              owner_name: ownerName,
              // owner_doc é mantido no campo notes para preservar rastreabilidade
              notes: ownerDoc ? `CPF/CNPJ proprietário: ${ownerDoc}` : null,
            }).select("id").single();
          if (eP) throw new Error(`property: ${eP.message}`);
          propertyId = insP!.id;
        }

        // ---------- 3) CONTRACT (insert) ----------
        const startDate = dueIso;
        const endDate = addMonths(dueIso, 12);
        const dueDay = Number(dueIso.slice(8, 10));
        const { error: eC } = await supabase.from("contracts").insert({
          user_id: userId,
          property_id: propertyId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          due_day: dueDay,
          rent_amount: rent,
          readjustment_index: "IGP-M",
          security_deposit: 0,
          active: true,
        });
        if (eC) throw new Error(`contract: ${eC.message}`);

        okCount += 1;
        setSuccess(okCount);
      } catch (err: any) {
        localErrors.push({
          line: lineNumber,
          reason: err?.message ?? String(err),
          raw: row as any,
        });
        setErrors([...localErrors]);
      }
    }

    setRunning(false);
    setFinished(true);
    toast.success(
      `Importação concluída! ${okCount} registros inseridos com sucesso. ${localErrors.length} falhas detectadas.`,
      { duration: 8000 },
    );
  }

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400 mb-2">
          <Database className="size-3.5" /> Admin
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Migrar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Importação relacional em massa — proprietários, inquilinos, imóveis e contratos a partir de um único CSV.
        </p>
      </header>

      {/* Modelo */}
      <Card className="p-5 border-violet-500/20 bg-violet-500/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Planilha modelo</p>
              <p className="text-sm text-muted-foreground">
                Use o modelo oficial com os cabeçalhos exatos: {TEMPLATE_HEADERS.join(", ")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
          >
            <Download className="size-4 mr-2" />
            Baixar Modelo de Planilha Padrão (.csv)
          </Button>
        </div>
      </Card>

      {/* Dropzone */}
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative overflow-hidden border-2 border-dashed transition-all duration-300 cursor-pointer",
          "bg-zinc-950/40",
          dragOver
            ? "border-violet-500 shadow-[0_0_40px_-5px_rgba(139,92,246,0.6)] bg-violet-500/[0.06]"
            : "border-zinc-800 hover:border-violet-500/60 hover:shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="py-14 px-6 flex flex-col items-center text-center">
          <div className={cn(
            "size-16 rounded-2xl grid place-items-center mb-4 transition-all",
            dragOver
              ? "bg-violet-500/20 text-violet-300 ring-2 ring-violet-500/60"
              : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800",
          )}>
            {file ? <FileUp className="size-7" /> : <Upload className="size-7" />}
          </div>
          {file ? (
            <>
              <p className="font-semibold text-zinc-100">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {rows.length} linha(s) válida(s) detectada(s) — pronto para importar.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-zinc-100">
                Arraste seu arquivo CSV aqui, ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Apenas arquivos .csv • máximo 10 MB
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {rows.length > 0 && !running && !finished && (
            <span>Pronto para processar <strong className="text-zinc-200">{rows.length}</strong> registro(s).</span>
          )}
        </div>
        <div className="flex gap-2">
          {(file || finished) && (
            <Button variant="ghost" onClick={reset} disabled={running}>Limpar</Button>
          )}
          <Button
            disabled={rows.length === 0 || running}
            onClick={processImport}
            className="bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_-6px_rgb(168_85_247)]"
          >
            {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            {running ? "Processando…" : "Iniciar Importação"}
          </Button>
        </div>
      </div>

      {/* Progress dashboard */}
      {(running || finished) && (
        <Card className="p-6 space-y-5 border-violet-500/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              icon={<Loader2 className={cn("size-4", running && "animate-spin")} />}
              label="Linha atual"
              value={`${current} / ${total}`}
              tone="violet"
            />
            <MetricCard
              icon={<CheckCircle2 className="size-4" />}
              label="Sucesso"
              value={String(success)}
              tone="emerald"
            />
            <MetricCard
              icon={<XCircle className="size-4" />}
              label="Erros"
              value={String(errors.length)}
              tone="rose"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {running ? `Processando linha ${current} de ${total}...` : "Concluído"}
              </span>
              <span className="text-violet-300 font-semibold tabular-nums">{percent}%</span>
            </div>
            <Progress
              value={percent}
              className="h-2 bg-zinc-900 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500 [&>div]:shadow-[0_0_12px_rgba(168,85,247,0.8)]"
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.05]">
              <div className="px-4 py-2.5 flex items-center gap-2 text-rose-300 text-sm border-b border-rose-500/20">
                <AlertTriangle className="size-4" />
                <span className="font-medium">{errors.length} linha(s) com erro</span>
              </div>
              <ScrollArea className="max-h-48">
                <ul className="divide-y divide-rose-500/10 text-sm">
                  {errors.map((e, i) => (
                    <li key={i} className="px-4 py-2">
                      <span className="text-rose-400 font-mono text-xs">Linha {e.line}</span>
                      <span className="text-muted-foreground"> — {e.reason}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
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
              <span className="text-emerald-400 font-semibold">{success}</span> registros inseridos com sucesso.{" "}
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

function MetricCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: "violet" | "emerald" | "rose" }) {
  const map = {
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/30",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  } as const;
  return (
    <div className={cn("rounded-xl border p-4", map[tone])}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
        {icon}<span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
