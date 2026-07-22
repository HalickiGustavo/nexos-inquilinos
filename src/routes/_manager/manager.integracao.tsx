import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Coins, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PixSplitConfigPanel } from "@/components/PixSplitConfigPanel";
import { getNexoFeeSetting } from "@/lib/asaas.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_manager/manager/integracao")({
  head: () => ({ meta: [{ title: "Saldo e Saque — NEXO Imobiliária" }] }),
  component: ManagerIntegracao,
});

function ManagerIntegracao() {
  const fetchFee = useServerFn(getNexoFeeSetting);
  const { data: feeData } = useQuery({
    queryKey: ["nexo-fee-setting"],
    queryFn: () => fetchFee(),
  });
  const nexoFee = feeData?.fee ?? 24.99;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Saldo e Saque</h1>
        <p className="text-muted-foreground mt-1">
          Configure a chave Pix de repasse da imobiliária. O split 3 vias (Nexo / Imobiliária / Proprietário) é gerado
          automaticamente quando o inquilino paga.
        </p>
      </header>

      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Pix Split nativo — sem subconta, sem KYC</AlertTitle>
        <AlertDescription>
          A plataforma Nexo recebe a taxa de serviço pela chave mestra fixa. Cada proprietário cadastra a própria chave
          Pix em <strong>Saldo e Saque</strong> do painel dele e o sistema busca automaticamente pelo proprietário
          vinculado ao imóvel ao gerar o Pix para o inquilino.
        </AlertDescription>
      </Alert>

      {/* Split preview */}
      <Card className="bg-muted/30">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-primary" />
            <h3 className="font-semibold">Split Automático Ativo</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            A cada parcela paga, o valor é dividido automaticamente entre imobiliária e proprietário.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Imobiliária</p>
              <p className="text-lg font-semibold mt-1">
                Taxa de administração <span className="text-xs font-normal text-muted-foreground">(% do aluguel)</span>
              </p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Proprietário</p>
              <p className="text-lg font-semibold mt-1">
                Valor líquido restante
                <Badge variant="outline" className="ml-2 text-[10px] inline-flex items-center gap-1">
                  <Coins className="size-2.5" /> Pix direto
                </Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chave Pix de repasse da imobiliária */}
      <PixSplitConfigPanel />
    </div>
  );
}
