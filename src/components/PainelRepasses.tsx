import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldAlert, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { configureAutomaticPayout, getAsaasAccount } from "@/lib/asaas.functions";

const BANK_LABEL: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "104": "Caixa Econômica",
  "237": "Bradesco",
  "341": "Itaú",
  "260": "Nubank",
  "077": "Inter",
  "212": "Banco Original",
  "336": "C6 Bank",
  "208": "BTG Pactual",
  "748": "Sicredi",
  "756": "Sicoob",
  "422": "Safra",
  "655": "Votorantim",
};

type Account = {
  kyc_status?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  auto_transfer_enabled?: boolean | null;
};

export function PainelRepasses() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(false);
  const fetchAcc = useServerFn(getAsaasAccount);
  const configure = useServerFn(configureAutomaticPayout);

  const reload = async () => {
    try {
      const res: any = await fetchAcc();
      setAcc(res?.account ?? null);
    } catch {
      // sem subconta — usuário ainda não fez onboarding
      setAcc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("asaas-account-self")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asaas_accounts" },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <Card className="p-5 flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando status de repasses...</span>
      </Card>
    );
  }

  const kyc = (acc?.kyc_status ?? "PENDENTE").toUpperCase();
  const isApproved = kyc === "APROVADO";
  const isFrozen = kyc === "PENDENTE" || kyc === "EM_ANALISE";

  if (isFrozen) {
    return (
      <Card className="p-5 border-amber-500/40 bg-amber-500/[0.07] shadow-[0_0_32px_-12px_rgb(245_158_11)]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-amber-900 dark:text-amber-100">
                Painel de Repasses — Verificação Pendente
              </h2>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                <Clock className="size-3 mr-1" />
                {kyc === "EM_ANALISE" ? "Em análise" : "Pendente"}
              </Badge>
            </div>
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-1.5">
              Seus repasses automáticos estão retidos. Envie ou aguarde a aprovação dos seus
              documentos de verificação para liberar a transferência para sua conta bancária.
            </p>
            <p className="text-xs text-amber-900/60 dark:text-amber-100/60 mt-1">
              Esta retenção segue as regras de compliance do Banco Central aplicáveis a contas de
              pagamento.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isApproved) {
    const bank = acc?.bank_code ? BANK_LABEL[acc.bank_code] ?? `Banco ${acc.bank_code}` : "—";
    const agency = acc?.bank_agency ?? "—";
    const account =
      acc?.bank_account && acc?.bank_account_digit
        ? `${acc.bank_account}-${acc.bank_account_digit}`
        : (acc?.bank_account ?? "—");
    const autoOn = !!acc?.auto_transfer_enabled;

    return (
      <Card className="p-5 border-emerald-500/40 bg-emerald-500/[0.06] shadow-[0_0_32px_-12px_rgb(16_185_129)]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">
                Painel de Repasses
              </h2>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="size-3 mr-1" />
                Verificada
              </Badge>
              {autoOn && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  Repasse diário ativo
                </Badge>
              )}
            </div>
            <p className="text-sm text-emerald-900/85 dark:text-emerald-100/85 mt-1.5 flex items-center gap-2 flex-wrap">
              <Landmark className="size-4" />
              {autoOn ? (
                <>
                  Conta verificada. Repasses automáticos diários ativos para a conta{" "}
                  <b>
                    {bank}, Ag. {agency}, C/C {account}
                  </b>
                  .
                </>
              ) : (
                <>
                  Conta verificada para <b>{bank}, Ag. {agency}, C/C {account}</b>. Ative os
                  repasses automáticos diários abaixo.
                </>
              )}
            </p>
            {!autoOn && (
              <div className="mt-3">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={configuring}
                  onClick={async () => {
                    setConfiguring(true);
                    try {
                      await configure();
                      toast.success("Repasses automáticos diários ativados!");
                      await reload();
                    } catch (e: any) {
                      toast.error(e?.message ?? "Falha ao ativar repasses automáticos");
                    } finally {
                      setConfiguring(false);
                    }
                  }}
                >
                  {configuring && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Ativar repasse diário
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // REJEITADO ou outro estado
  return (
    <Card className="p-5 border-destructive/40 bg-destructive/[0.07]">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-destructive/20 text-destructive shrink-0">
          <ShieldAlert className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-destructive">Painel de Repasses — Verificação Rejeitada</h2>
          <p className="text-sm text-destructive/85 mt-1.5">
            Seus documentos foram rejeitados pelo gateway. Reenvie os documentos na aba de
            Integrações para liberar os repasses automáticos.
          </p>
        </div>
      </div>
    </Card>
  );
}
