import { createFileRoute } from "@tanstack/react-router";
import { Download, MapPin, ClipboardCheck, FileText, CalendarDays, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantActiveContract } from "@/lib/tenant-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";

import { openContractPdf } from "@/components/ContractPdfUploader";
import {
  COND_LABEL,
  KIND_LABEL,
  STATUS_LABEL,
  getSignedPdfUrl,
  useTenantInspections,
  type InspectionCondition,
  type InspectionKind,
  type InspectionStatus,
} from "@/lib/inspections";

export const Route = createFileRoute("/_authenticated/tenant/contrato")({
  head: () => ({ meta: [{ title: "Meu Contrato — Nexo Inquilino" }] }),
  component: TenantContrato,
});

function monthsBetween(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function TenantContrato() {
  const { data: contract, isLoading } = useTenantActiveContract();

  if (isLoading) return <TenantContratoSkeleton />;
  if (!contract)
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Você não possui contrato ativo no momento.</p>
      </Card>
    );


  const total = monthsBetween(contract.start_date, contract.end_date);
  const elapsed = Math.max(
    0,
    Math.min(total, monthsBetween(contract.start_date, new Date().toISOString().slice(0, 10))),
  );
  const progress = total > 0 ? (elapsed / total) * 100 : 0;
  const remaining = Math.max(0, total - elapsed);
  const p = contract.property;

  const downloadContract = async () => {
    if (contract.contract_pdf_path) {
      try {
        await openContractPdf(contract.contract_pdf_path);
      } catch (e: any) {
        toast.error(e.message ?? "Falha ao abrir contrato");
      }
      return;
    }
    downloadPdf(`contrato-${contract.id.slice(0, 8)}.pdf`, [
      "CONTRATO DE LOCAÇÃO RESIDENCIAL",
      "",
      `Imóvel: ${p?.nickname ?? ""}`,
      `Endereço: ${p?.address ?? ""}, ${p?.city ?? ""} - ${p?.state ?? ""}`,
      "",
      `Período: ${formatDate(contract.start_date)} a ${formatDate(contract.end_date)}`,
      `Valor do aluguel: ${formatBRL(Number(contract.rent_amount))}`,
      `Vencimento: todo dia ${contract.due_day}`,
      `Índice de reajuste: ${contract.readjustment_index}`,
      `Caução: ${formatBRL(Number(contract.security_deposit))}`,
      "",
      contract.notes ?? "",
      "",
      "Este documento é uma cópia simplificada para conferência.",
    ]);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Meu Contrato</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Detalhes da sua locação atual.</p>
      </header>

      {/* Imóvel */}
      <Section icon={<MapPin className="size-4" />} title="Imóvel">
        <p className="text-lg font-semibold">{p?.nickname}</p>
        {p && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {p.address}
            {p.city ? `, ${p.city}` : ""}
            {p.state ? ` - ${p.state}` : ""}
          </p>
        )}
      </Section>

      {/* Financeiro */}
      <Section icon={<Wallet className="size-4" />} title="Financeiro">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Aluguel mensal" value={formatBRL(Number(contract.rent_amount))} strong />
          <Stat label="Dia de vencimento" value={`Todo dia ${contract.due_day}`} />
          <Stat label="Reajuste" value={contract.readjustment_index} />
        </div>
      </Section>

      {/* Prazo */}
      <Section icon={<CalendarDays className="size-4" />} title="Prazo">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Início" value={formatDate(contract.start_date)} />
          <Stat label="Término" value={formatDate(contract.end_date)} />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progresso do contrato</span>
            <span className="font-medium tabular-nums">
              {elapsed}/{total} meses
            </span>
          </div>
          <Progress value={progress} />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {remaining} {remaining === 1 ? "mês restante" : "meses restantes"}
          </p>
        </div>
      </Section>

      {/* Garantias */}
      <Section icon={<ShieldCheck className="size-4" />} title="Garantias">
        <Stat label="Caução" value={formatBRL(Number(contract.security_deposit))} />
      </Section>

      <Button variant="outline" className="w-full" onClick={downloadContract}>
        <Download className="size-4 mr-2" />
        {contract.contract_pdf_path ? "Baixar contrato anexado (PDF)" : "Baixar contrato (PDF)"}
      </Button>

      <TenantInspections contractId={contract.id} />
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5 border-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="grid size-6 place-items-center rounded-md border border-border bg-muted/40 text-foreground/80">
          {icon}
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={strong ? "text-base font-semibold mt-0.5 tabular-nums" : "text-sm font-medium mt-0.5"}>
        {value}
      </p>
    </div>
  );
}

function TenantInspections({ contractId }: { contractId: string }) {
  const { data: inspections = [], isLoading } = useTenantInspections(contractId);

  async function open(path: string | null) {
    if (!path) return toast.error("PDF indisponível.");
    try {
      const url = await getSignedPdfUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao abrir PDF");
    }
  }

  return (
    <Card className="p-4 sm:p-5 border-border space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md border border-border bg-muted/40 text-foreground/80">
          <ClipboardCheck className="size-4" />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vistorias</h2>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : inspections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma vistoria registrada para este contrato.
        </p>
      ) : (
        <div className="space-y-2">
          {inspections.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/20 flex-wrap"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {KIND_LABEL[i.kind as InspectionKind]}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {STATUS_LABEL[i.status as InspectionStatus]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(i.inspection_date)} • Estado geral:{" "}
                  {COND_LABEL[i.general_condition as InspectionCondition]}
                </p>
              </div>
              {i.pdf_path && (
                <Button size="sm" variant="outline" onClick={() => open(i.pdf_path)}>
                  <FileText className="size-3.5 mr-1.5" />
                  Abrir PDF
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
