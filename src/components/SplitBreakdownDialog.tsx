import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";
import { ArrowRight, Building2, Sparkles } from "lucide-react";

export const NEXO_FEE_PER_INSTALLMENT = 4.9;

export function SplitBreakdownDialog({
  installment,
  open,
  onOpenChange,
}: {
  installment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!installment) return null;
  const exps = parseExpenses(installment.variable_expenses);
  const t = expensesTotals(exps);
  const rentAndFees = Number(installment.amount) + t.tenant;
  const nexoFee = NEXO_FEE_PER_INSTALLMENT;
  const totalBoleto = rentAndFees + nexoFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhamento do Split — {formatDate(installment.due_date)}</DialogTitle>
          <DialogDescription>
            Composição automática do boleto/Pix gerado para o inquilino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Subconta */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-primary" />
              Valor do Aluguel + Taxas Extras
              <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary/30 text-[10px]">
                Subconta Imobiliária
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Aluguel</span><span>{formatBRL(installment.amount)}</span></div>
              {exps.filter((e) => e.payer === "inquilino").map((e) => (
                <div key={e.id} className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>+ {e.description}</span><span>{formatBRL(e.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-1 border-t mt-1">
                <span>Subtotal</span><span>{formatBRL(rentAndFees)}</span>
              </div>
            </div>
          </div>

          {/* NEXO Fee */}
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              Taxa de Serviço Digital Portal NEXO
              <Badge variant="outline" className="ml-auto bg-primary text-primary-foreground border-primary text-[10px]">
                Split NEXO
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Repassado automaticamente para a conta master NEXO via split Asaas.
            </p>
            <div className="flex justify-between font-semibold text-sm mt-2">
              <span>Taxa fixa</span><span>{formatBRL(nexoFee)}</span>
            </div>
          </div>

          {/* Total */}
          <div className="rounded-lg border-2 border-primary bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Valor Total do Boleto/Pix</span>
              <span className="text-2xl font-bold text-primary">{formatBRL(totalBoleto)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valor que o inquilino efetivamente paga.</p>
          </div>

          {/* Split visual */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Split Automático Ativo
            </p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{formatBRL(totalBoleto)}</span>
              <ArrowRight className="size-3" />
              <span className="text-primary font-medium">{formatBRL(nexoFee)} NEXO</span>
              <span>+</span>
              <span className="text-foreground font-medium">{formatBRL(rentAndFees)} sua conta</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
