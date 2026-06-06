import { createFileRoute } from "@tanstack/react-router";
import { Download, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTenantActiveContract } from "@/lib/tenant-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";

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

        <div className="grid grid-cols-2 gap-4">
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
          onClick={() =>
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
            ])
          }
        >
          <Download className="size-4 mr-2" /> Baixar contrato (PDF)
        </Button>
      </Card>
    </div>
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
