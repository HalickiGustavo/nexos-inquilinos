import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, ChevronDown, QrCode, Handshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantInstallments, useTenantActiveContract } from "@/lib/tenant-queries";
import { formatBRL, formatDate, today } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureTenantPixCharge } from "@/lib/asaas.functions";
import { generateTripleSplitPix } from "@/lib/pix-split.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/tenant/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Nexo Inquilino" }] }),
  component: TenantFinanceiro,
});



type Status = "pago" | "pendente" | "atrasado" | "acordo_fechado" | "agendado" | "em_aberto";
function statusOf(i: any): Status {
  if (i.status === "pago") return "pago";
  if (i.status === "acordo_fechado") return "acordo_fechado";
  if (i.status === "agendado") return "agendado";
  if (i.status === "em_aberto") {
    if (i.due_date < today()) return "atrasado";
    return "em_aberto";
  }
  if (i.due_date < today()) return "atrasado";
  return "pendente";
}

const badge: Record<Status, { label: string; className: string }> = {
  pago: { label: "Pago", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  em_aberto: { label: "Em aberto", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  atrasado: { label: "Atrasado", className: "bg-destructive/15 text-destructive border-destructive/30" },
  acordo_fechado: { label: "Acordo Fechado", className: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  agendado: { label: "Agendado", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
};


function TenantFinanceiro() {
  const { data: contract } = useTenantActiveContract();
  const { data: items = [], isLoading } = useTenantInstallments();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pixFor, setPixFor] = useState<any | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<any | null>(null);
  const ensurePix = useServerFn(ensureTenantPixCharge);
  const tripleSplit = useServerFn(generateTripleSplitPix);
  const queryClient = useQueryClient();

  const openPix = async (i: any) => {
    setPixFor(i);
    setPixError(null);
    if (i.pix_qrcode && i.pix_payload) return;
    setPixLoading(true);
    try {
      // Tenta primeiro o split nativo de 3 vias (Nexo + Imobiliária + Proprietário).
      // Se a plataforma/imobiliária/proprietário não tiverem chave Pix configurada,
      // cai no Asaas (subconta) como fallback.
      let res: any;
      try {
        res = await tripleSplit({ data: { installmentId: i.id } });
      } catch {
        res = { ok: false };
      }
      if (!res?.ok) {
        res = await ensurePix({ data: { installmentId: i.id } });
        if (res?.ok === false) {
          setPixError(res.error ?? "Não foi possível gerar o PIX no momento.");
          return;
        }
        setPixFor({
          ...i,
          pix_qrcode: res.pixQrCode,
          pix_payload: res.pixPayload,
          boleto_url: res.boletoUrl ?? i.boleto_url,
        });
      } else {
        setPixFor({
          ...i,
          pix_qrcode: res.qrCodeBase64,
          pix_payload: res.pixPayload,
          split_breakdown: res.breakdown,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["tenant-installments"] });
    } catch (e: any) {
      setPixError(e?.message ?? "Erro ao gerar PIX");
    } finally {
      setPixLoading(false);
    }
  };

  useEffect(() => {
    if (!contract?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("debt_agreements")
        .select("*")
        .eq("contract_id", contract.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1);
      setAgreement(data?.[0] ?? null);
    })();
  }, [contract?.id]);

  const agreementInstallments = agreement
    ? [...items].filter((i: any) => i.debt_agreement_id === agreement.id)
    : [];
  const sorted = [...items].sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Boletos & Finanças</h1>
        <p className="text-sm text-muted-foreground">Histórico de parcelas do seu contrato.</p>
      </header>

      {agreement && (
        <Card className="p-5 border-violet-500/40 bg-violet-500/[0.07] shadow-[0_0_32px_-12px_rgb(168_85_247)]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300">
              <Handshake className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-violet-100">Acordo de Renegociação Ativo</p>
                <Badge variant="outline" className="border-violet-400/40 text-violet-200 bg-violet-500/10">
                  {agreement.installments_count}x
                </Badge>
              </div>
              <p className="text-sm text-violet-200/80 mt-1">
                Suas parcelas atrasadas foram substituídas por <b>{agreement.installments_count}</b> parcela(s) de{" "}
                <b>{formatBRL(Number(agreement.total_amount) / agreement.installments_count)}</b>.
              </p>
              <p className="text-xs text-violet-200/60 mt-1">
                Total renegociado: {formatBRL(Number(agreement.total_amount))} • 1º vencimento {formatDate(agreement.first_due_date)}
              </p>
              {agreementInstallments.length > 0 && (
                <p className="text-xs text-violet-200/60 mt-1">
                  {agreementInstallments.filter((i: any) => i.status === "pago").length} de {agreementInstallments.length} parcela(s) já pagas.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
      {!isLoading && sorted.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">Nenhuma parcela registrada ainda.</Card>
      )}


      <div className="space-y-2">
        {sorted.map((i: any) => {
          const s = statusOf(i);
          const open = openId === i.id;
          const exps = parseExpenses(i.variable_expenses);
          const t = expensesTotals(exps);
          const totalDue = Number(i.amount) + t.tenant;
          return (
            <Card
              key={i.id}
              className={cn(
                "overflow-hidden transition",
                s === "agendado" && "opacity-70 border-dashed bg-muted/40",
              )}
            >
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40 transition"
                onClick={() => setOpenId(open ? null : i.id)}
              >
                <div>
                  <p className={cn("font-medium", s === "agendado" && "text-muted-foreground")}>
                    {formatBRL(totalDue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento {formatDate(i.due_date)}
                    {t.tenant > 0 && <span className="ml-2 text-amber-600">+ {formatBRL(t.tenant)} despesas</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("border", badge[s].className)}>
                    {badge[s].label}
                  </Badge>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
                </div>
              </button>

              {open && (
                <div className="border-t p-4 bg-muted/20 space-y-3">
                  <div className="rounded-md border bg-background p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Aluguel</span><span>{formatBRL(Number(i.amount))}</span></div>
                    {exps.filter((e) => e.payer === "inquilino").map((e) => (
                      <div key={e.id} className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>+ {e.description}</span><span>{formatBRL(e.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-1 border-t mt-1">
                      <span>Total a pagar</span><span>{formatBRL(totalDue)}</span>
                    </div>
                  </div>
                  {s === "agendado" ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Parcela agendada. O boleto e o PIX serão liberados automaticamente até 15 dias antes do vencimento.
                    </p>
                  ) : s === "pago" ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Pago em {i.payment_date ? formatDate(i.payment_date) : "—"}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadPdf(`recibo-${i.due_date}.pdf`, [
                            "RECIBO DE PAGAMENTO DE ALUGUEL",
                            "",
                            `Imóvel: ${contract?.property?.nickname ?? ""}`,
                            `Vencimento: ${formatDate(i.due_date)}`,
                            `Pago em: ${i.payment_date ? formatDate(i.payment_date) : ""}`,
                            `Valor: ${formatBRL(Number(i.paid_amount || i.amount))}`,
                            "",
                            "Pagamento confirmado. Obrigado!",
                            "",
                            "— Nexo",
                          ])
                        }
                      >
                        <Download className="size-4 mr-2" /> Baixar recibo
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                        onClick={() => openPix(i)}
                      >
                        <QrCode className="size-5 mr-2" /> Pagar com PIX — {formatBRL(totalDue)}
                      </Button>
                      {i.boleto_url ? (
                        <Button variant="outline" className="w-full" asChild>
                          <a href={i.boleto_url} target="_blank" rel="noreferrer">
                            <Download className="size-4 mr-2" /> Visualizar Boleto PDF
                          </a>
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center">
                          Boleto em emissão. Use o PIX acima para pagamento imediato.
                        </p>
                      )}
                    </>
                  )}

                </div>
              )}
            </Card>
          );
        })}
      </div>
      <PixPaymentDialog
        installment={pixFor}
        open={!!pixFor}
        loading={pixLoading}
        error={pixError}
        onOpenChange={(o) => {
          if (!o) {
            setPixFor(null);
            setPixError(null);
            setPixLoading(false);
          }
        }}
      />
    </div>
  );
}
