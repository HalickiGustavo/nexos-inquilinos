import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantInstallments, useTenantActiveContract } from "@/lib/tenant-queries";
import { formatBRL, formatDate, today } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tenant/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Nexo Inquilino" }] }),
  component: TenantFinanceiro,
});

const PIX_KEY = "contato@nexo.com.br";

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
          return (
            <Card key={i.id} className="overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40 transition"
                onClick={() => setOpenId(open ? null : i.id)}
              >
                <div>
                  <p className="font-medium">{formatBRL(Number(i.amount))}</p>
                  <p className="text-xs text-muted-foreground">Vencimento {formatDate(i.due_date)}</p>
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
                      {i.pix_qrcode && (
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${i.pix_qrcode}`}
                            alt="QR Code Pix"
                            className="w-48 h-48 rounded border bg-white p-2"
                          />
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase text-muted-foreground tracking-wide">Pix Copia e Cola</p>
                        <p className="font-mono text-xs break-all">{i.pix_payload ?? PIX_KEY}</p>
                      </div>
                      {i.barcode && (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Linha digitável</p>
                          <p className="font-mono text-xs break-all text-muted-foreground">{i.barcode}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(i.pix_payload ?? PIX_KEY);
                            toast.success("Pix copiado!");
                          }}
                        >
                          <Copy className="size-4 mr-2" /> Copiar Pix
                        </Button>
                        {i.boleto_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={i.boleto_url} target="_blank" rel="noreferrer">
                              <Download className="size-4 mr-2" /> Abrir boleto
                            </a>
                          </Button>
                        )}
                      </div>
                      {!i.boleto_url && (
                        <p className="text-xs text-muted-foreground">
                          Aguardando emissão do boleto pelo proprietário.
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
    </div>
  );
}
