import { createFileRoute } from "@tanstack/react-router";
import { Download, MapPin, ClipboardCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Meu Contrato</h1>
        <p className="text-sm text-muted-foreground">Detalhes da sua locação atual.</p>
      </header>

      <Card className="p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Imóvel</p>
          <p className="text-xl font-semibold mt-1">{p?.nickname}</p>
          {p && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="size-3.5" />
              {p.address}
              {p.city ? `, ${p.city}` : ""}
              {p.state ? ` - ${p.state}` : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Stat label="Aluguel mensal" value={formatBRL(Number(contract.rent_amount))} />
          <Stat label="Dia de vencimento" value={`Todo dia ${contract.due_day}`} />
          <Stat label="Início" value={formatDate(contract.start_date)} />
          <Stat label="Término" value={formatDate(contract.end_date)} />
          <Stat label="Reajuste" value={contract.readjustment_index} />
          <Stat label="Caução" value={formatBRL(Number(contract.security_deposit))} />
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Progresso do contrato</span>
            <span className="font-medium">
              {elapsed}/{total} meses
            </span>
          </div>
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground mt-1.5">{remaining} meses restantes</p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
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
          }}
        >
          <Download className="size-4 mr-2" />
          {contract.contract_pdf_path ? "Baixar contrato anexado (PDF)" : "Baixar contrato (PDF)"}
        </Button>
      </Card>

      <TenantInspections contractId={contract.id} />
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
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-4 text-primary" />
        <h2 className="font-semibold">Vistorias</h2>
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
              className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30 flex-wrap"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
