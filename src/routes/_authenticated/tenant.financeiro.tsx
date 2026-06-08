import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ChevronDown, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantInstallments, useTenantActiveContract } from "@/lib/tenant-queries";
import { formatBRL, formatDate, today } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tenant/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Nexo Inquilino" }] }),
  component: TenantFinanceiro,
});



type Status = "pago" | "pendente" | "atrasado";
function statusOf(i: any): Status {
  if (i.status === "pago") return "pago";
  if (i.due_date < today()) return "atrasado";
  return "pendente";
}

const badge: Record<Status, { label: string; className: string }> = {
  pago: { label: "Pago", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  atrasado: { label: "Atrasado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function TenantFinanceiro() {
  const { data: contract } = useTenantActiveContract();
  const { data: items = [], isLoading } = useTenantInstallments();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pixFor, setPixFor] = useState<any | null>(null);

  const sorted = [...items].sort((a: any, b: any) => b.due_date.localeCompare(a.due_date));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Boletos & Finanças</h1>
        <p className="text-sm text-muted-foreground">Histórico de parcelas do seu contrato.</p>
      </header>

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
            <Card key={i.id} className="overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40 transition"
                onClick={() => setOpenId(open ? null : i.id)}
              >
                <div>
                  <p className="font-medium">{formatBRL(totalDue)}</p>
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
                  {s === "pago" ? (
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
                        onClick={() => setPixFor(i)}
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
        onOpenChange={(o) => !o && setPixFor(null)}
      />
    </div>
  );
}
