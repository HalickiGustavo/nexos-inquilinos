import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { QrCode, Wallet, FileText, Wrench, Bell, MapPin, ArrowUpRight, CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";
import { usePixPayment } from "@/hooks/usePixPayment";
import {
  useCurrentTenant,
  useTenantActiveContract,
  useTenantInstallments,
  useTenantMaintenances,
} from "@/lib/tenant-queries";
import { formatBRL, formatDate, today } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tenant/")({
  head: () => ({ meta: [{ title: "Início — Nexo Inquilino" }] }),
  component: TenantHome,
});

function TenantHome() {
  const { data: tenant, isPending: tenantPending } = useCurrentTenant();
  const { data: contract, isPending: contractPending } = useTenantActiveContract();
  const { data: installments = [], isPending: installmentsPending } = useTenantInstallments();
  const { data: maintenances = [], isPending: maintenancesPending } = useTenantMaintenances();

  const loading = tenantPending || contractPending || installmentsPending || maintenancesPending;


  const todayStr = today();
  const upcoming = useMemo(
    () =>
      installments
        .filter((i: any) => i.status !== "pago")
        .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))[0],
    [installments],
  );

  const overdue = !!upcoming && upcoming.due_date < todayStr;
  const daysLeft = upcoming
    ? Math.round((new Date(upcoming.due_date).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const openCount = maintenances.filter((m: any) => m.status !== "concluido").length;

  const { open: openPix, dialogProps: pixDialogProps } = usePixPayment({
    invalidateKeys: [["tenant-installments"]],
  });

  const firstName = tenant?.full_name ? tenant.full_name.split(" ")[0] : "";
  const statusLabel = !upcoming
    ? "Em dia"
    : overdue
      ? "Em atraso"
      : daysLeft === 0
        ? "Vence hoje"
        : daysLeft && daysLeft > 0
          ? `Vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`
          : "Próximo aluguel";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {tenantPending ? (
            <Skeleton className="h-7 w-40" />
          ) : (
            <>Olá{firstName ? `, ${firstName}` : ""}</>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aqui está o resumo do seu aluguel.
        </p>
      </header>

      {loading ? <TenantHomeSkeleton /> : (
      <>
      {/* Card principal — Status + Valor + Vencimento + CTA */}
      <Card className="relative overflow-hidden border-border">

        <div className="p-5 sm:p-6">
          {/* Badge de status discreta */}
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                !upcoming
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                  : overdue
                    ? "border-destructive/40 text-destructive bg-destructive/5"
                    : "border-primary/40 text-primary bg-primary/5",
              )}
            >
              {!upcoming ? <CheckCircle2 className="size-3" /> : <Wallet className="size-3" />}
              {statusLabel}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {upcoming ? "Próximo aluguel" : "Contrato em dia"}
            </span>
          </div>

          {upcoming ? (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-4xl sm:text-5xl font-bold tabular-nums leading-none">
                  {formatBRL(Number(upcoming.amount))}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Vencimento em{" "}
                <span className="font-medium text-foreground">{formatDate(upcoming.due_date)}</span>
              </p>

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <Button
                  size="lg"
                  className="flex-1 font-semibold"
                  onClick={() => openPix(upcoming)}
                >
                  <QrCode className="size-4 mr-2" /> Pagar agora
                </Button>
                <Button variant="outline" size="lg" asChild className="sm:w-auto">
                  <Link to="/tenant/financeiro">Ver histórico</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-semibold mt-4">Nenhum boleto em aberto.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Você está em dia com o aluguel. Aproveite.
              </p>
              <div className="mt-5">
                <Button variant="outline" asChild>
                  <Link to="/tenant/financeiro">Ver histórico</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Cards secundários */}
      <div className="grid grid-cols-2 gap-3">
        <SecondaryCard
          to="/tenant/contrato"
          icon={<MapPin className="size-4" />}
          title="Meu imóvel"
          value={contract?.property?.nickname ?? "—"}
          hint={
            contract?.property?.address
              ? `${contract.property.address}${contract.property.city ? `, ${contract.property.city}` : ""}`
              : "Sem contrato ativo"
          }
        />
        <SecondaryCard
          to="/tenant/manutencoes"
          icon={<Wrench className="size-4" />}
          title="Chamados"
          value={openCount === 0 ? "Nenhum aberto" : `${openCount} em andamento`}
          hint="Toque para abrir um novo chamado"
        />
        <SecondaryCard
          to="/tenant/contrato"
          icon={<FileText className="size-4" />}
          title="Contrato"
          value={
            contract
              ? `Até ${formatDate(contract.end_date)}`
              : "—"
          }
          hint={contract ? `Aluguel ${formatBRL(Number(contract.rent_amount))}/mês` : "Sem contrato ativo"}
        />
        <SecondaryCard
          to="/tenant/alertas"
          icon={<Bell className="size-4" />}
          title="Alertas"
          value="Ver notificações"
          hint="Avisos importantes do seu contrato"
        />
      </div>
      </>
      )}

      <PixPaymentDialog {...pixDialogProps} />
    </div>
  );
}

function TenantHomeSkeleton() {
  return (
    <>
      <Card className="border-border">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-40" />
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 sm:w-32" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-full p-4 border-border space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>
    </>
  );
}


function SecondaryCard({
  to,
  icon,
  title,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link to={to as any} className="group block">
      <Card className="h-full p-4 border-border transition-colors hover:border-primary/40 hover:bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="grid size-7 place-items-center rounded-md border border-border bg-muted/40 text-foreground/80">
              {icon}
            </span>
            <span className="text-xs font-medium">{title}</span>
          </div>
          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="mt-3 text-sm font-semibold truncate">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</p>}
      </Card>
    </Link>
  );
}
