import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, QrCode, Wallet, FileText, Wrench, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";
import { generateTripleSplitPix } from "@/lib/pix-split.functions";
import {
  useCurrentTenant,
  useTenantActiveContract,
  useTenantInstallments,
  useTenantMaintenances,
} from "@/lib/tenant-queries";
import { formatBRL, formatDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tenant/")({
  head: () => ({ meta: [{ title: "Início — Nexo Inquilino" }] }),
  component: TenantHome,
});



function TenantHome() {
  const { data: tenant } = useCurrentTenant();
  const { data: contract } = useTenantActiveContract();
  const { data: installments = [] } = useTenantInstallments();
  const { data: maintenances = [] } = useTenantMaintenances();

  const todayStr = today();
  const upcoming = installments
    .filter((i: any) => i.status !== "pago")
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))[0];

  const overdue = upcoming && upcoming.due_date < todayStr;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (Notification.permission === "granted" && overdue && upcoming) {
      try {
        new Notification("Aluguel em atraso", {
          body: `Vencimento ${formatDate(upcoming.due_date)} • ${formatBRL(Number(upcoming.amount))}`,
        });
      } catch {}
    }
  }, [overdue, upcoming?.id]);

  const openCount = maintenances.filter((m: any) => m.status !== "concluido").length;

  const tripleSplit = useServerFn(generateTripleSplitPix);
  const queryClient = useQueryClient();
  const [pixFor, setPixFor] = useState<any | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);

  const openPix = async (i: any) => {
    setPixFor(i);
    setPixError(null);
    if (i.pix_qrcode && i.pix_payload) return;
    setPixLoading(true);
    try {
      const res: any = await tripleSplit({ data: { installmentId: i.id } });
      if (!res?.ok) {
        setPixError(res?.error ?? "Não foi possível gerar o PIX.");
        return;
      }
      setPixFor({
        ...i,
        pix_qrcode: res.qrCodeBase64,
        pix_payload: res.pixPayload,
        split_breakdown: res.breakdown,
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-installments"] });
    } catch (e: any) {
      setPixError(e?.message ?? "Erro ao gerar PIX");
    } finally {
      setPixLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <header>
        <h1 className="text-2xl font-bold">Olá{tenant?.full_name ? `, ${tenant.full_name.split(" ")[0]}` : ""} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Tudo o que você precisa sobre seu aluguel.</p>
      </header>

      {/* Próximo aluguel */}
      <Card
        className={
          "p-5 border-l-4 " +
          (overdue
            ? "border-l-destructive bg-destructive/5"
            : upcoming
              ? "border-l-warning bg-warning/5"
              : "border-l-primary")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {overdue ? "Aluguel em atraso" : "Próximo aluguel"}
              </span>
              {overdue && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" /> Atrasado
                </Badge>
              )}
            </div>
            {upcoming ? (
              <>
                <p className="text-3xl font-bold mt-1">{formatBRL(Number(upcoming.amount))}</p>
                <p className="text-sm text-muted-foreground">
                  Vencimento em <span className="font-medium text-foreground">{formatDate(upcoming.due_date)}</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground mt-2">Nenhuma parcela pendente. 🎉</p>
            )}
          </div>
          <Wallet className="size-8 text-primary/70" />
        </div>

        {upcoming && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => openPix(upcoming)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <QrCode className="size-4 mr-2" /> Gerar QR Pix — {formatBRL(Number(upcoming.amount))}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/tenant/financeiro">Ver boleto</Link>
            </Button>
          </div>
        )}
      </Card>

      {/* Mini cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/tenant/contrato">
          <Card className="p-4 hover:shadow-md transition cursor-pointer h-full">
            <FileText className="size-5 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Imóvel atual</p>
            <p className="font-medium truncate">{contract?.property?.nickname ?? "—"}</p>
          </Card>
        </Link>
        <Link to="/tenant/manutencoes">
          <Card className="p-4 hover:shadow-md transition cursor-pointer h-full">
            <Wrench className="size-5 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Chamados abertos</p>
            <p className="font-medium">{openCount}</p>
          </Card>
        </Link>
      </div>

      {!("Notification" in (typeof window !== "undefined" ? window : {})) ? null : Notification.permission === "denied" ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Bell className="size-3" /> Notificações desativadas no navegador.
        </p>
      ) : null}
    </div>
  );
}
