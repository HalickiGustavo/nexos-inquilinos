import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  useLandlordSaldo, useLandlordWithdrawals, useLandlordProfile,
} from "@/lib/landlord-queries";
import { useQueryClient } from "@tanstack/react-query";
import { formatBRL, formatDate } from "@/lib/format";
import { EmptyLine, Panel, Pill, SectionHeader, URBANIST } from "@/components/landlord/ui";

export const Route = createFileRoute("/_landlord/landlord/saldo")({
  head: () => ({ meta: [{ title: "Saldo & Saque — Proprietário NEXO" }] }),
  component: LandlordSaldo,
});

type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

function LandlordSaldo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { saldoDisponivel, totalRecebido, totalSacado, loading } = useLandlordSaldo();
  const { data: withdrawals = [] } = useLandlordWithdrawals();
  const { data: profile } = useLandlordProfile();

  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<PixKeyType>("cpf");
  const [savingKey, setSavingKey] = useState(false);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveType = (pixKey ? pixType : (profile?.pix_key_type as PixKeyType)) || "cpf";

  async function savePix() {
    if (!user?.id) return;
    const nextPixKey = pixKey.trim() || profile?.pix_key || "";
    if (!nextPixKey) {
      toast.error("Informe a chave PIX.");
      return;
    }
    setSavingKey(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ pix_key: nextPixKey, pix_key_type: pixType } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Chave PIX salva!");
      qc.invalidateQueries({ queryKey: ["landlord", "profile"] });
      setPixKey("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    } finally {
      setSavingKey(false);
    }
  }

  async function requestWithdrawal() {
    if (!user?.id) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (value > saldoDisponivel) {
      toast.error("Valor maior que o saldo disponível.");
      return;
    }
    if (!profile?.pix_key) {
      toast.error("Cadastre uma chave PIX antes de solicitar saque.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: prop } = await supabase
        .from("properties").select("user_id")
        .eq("landlord_id", user.id).limit(1).maybeSingle();

      const { error } = await supabase.from("landlord_withdrawals").insert({
        landlord_user_id: user.id,
        manager_user_id: prop?.user_id ?? null,
        amount: value,
        pix_key: profile.pix_key!,
        pix_key_type: profile.pix_key_type!,
        status: "solicitado",
      });
      if (error) throw error;
      toast.success("Saque solicitado! A imobiliária recebeu sua solicitação.");
      setOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["landlord", "withdrawals"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar saque.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Hero de saldo */}
      <div className="relative overflow-hidden rounded-2xl border border-[#4f46e5]/30 bg-gradient-to-br from-[#1e1e5a] via-[#141432] to-[#0a0a1a] p-8 shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#4f46e5]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#4f46e5]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-[#a5b4fc]">
              Saldo Disponível
            </p>
            <p
              className="text-5xl font-extrabold text-white tracking-tight tabular-nums md:text-6xl"
              style={URBANIST}
            >
              {loading ? "—" : formatBRL(saldoDisponivel)}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
              <span>
                Recebido:{" "}
                <span className="font-bold text-white tabular-nums" style={URBANIST}>
                  {formatBRL(totalRecebido)}
                </span>
              </span>
              <span>
                Sacado / em processo:{" "}
                <span className="font-bold text-white tabular-nums" style={URBANIST}>
                  {formatBRL(totalSacado)}
                </span>
              </span>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={saldoDisponivel <= 0 || !profile?.pix_key}
                className="h-12 gap-2 rounded-xl bg-[#4f46e5] px-6 text-sm font-bold text-white shadow-lg shadow-[#4f46e5]/30 transition-all hover:bg-[#5b52f1] hover:shadow-[#4f46e5]/50"
              >
                <ArrowDownToLine className="size-4" />
                Solicitar saque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar saque PIX</DialogTitle>
                <DialogDescription>
                  Será enviado para a chave: <strong>{profile?.pix_key}</strong> ({profile?.pix_key_type}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={saldoDisponivel}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: <strong>{formatBRL(saldoDisponivel)}</strong>
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={requestWithdrawal} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="mr-2 size-4" />
                  )}
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* PIX + histórico */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <SectionHeader title="Chave PIX" />
          <Panel padded className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#4f46e5]/30 bg-[#4f46e5]/10 text-[#a5b4fc]">
                <KeyRound className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chave atual</p>
                {profile?.pix_key ? (
                  <>
                    <p className="truncate font-bold text-white" style={URBANIST}>{profile.pix_key}</p>
                    <p className="text-xs text-slate-400">Tipo: {profile.pix_key_type}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma chave cadastrada.</p>
                )}
              </div>
            </div>

            <div className="space-y-2 border-t border-[#1e1e5a] pt-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Atualizar chave
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr]">
                <Select value={effectiveType} onValueChange={(v) => setPixType(v as PixKeyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder={profile?.pix_key || "Digite a nova chave"}
                />
              </div>
              <Button
                onClick={savePix}
                disabled={savingKey || !pixKey.trim()}
                className="w-full gap-2 rounded-xl bg-[#4f46e5] font-bold text-white hover:bg-[#5b52f1]"
              >
                {savingKey ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar chave
              </Button>
              <p className="text-[11px] text-slate-500">
                O repasse é feito via PIX instantâneo direto para essa chave assim que a Nexo confirma o recebimento.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-6 xl:col-span-3">
          <SectionHeader title="Histórico de Saques" />
          <Panel>
            {(withdrawals as any[]).length === 0 ? (
              <EmptyLine text="Nenhum saque solicitado ainda." />
            ) : (
              <ul className="divide-y divide-[#1e1e5a]/50">
                {(withdrawals as any[]).map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 transition-colors hover:bg-[#1e1e5a]/20"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-white tabular-nums" style={URBANIST}>
                        {formatBRL(Number(w.amount))}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(w.requested_at)} • {w.pix_key} ({w.pix_key_type})
                      </p>
                    </div>
                    <WithdrawalStatus status={w.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function WithdrawalStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: React.ComponentProps<typeof Pill>["tone"]; icon: React.ReactNode }> = {
    solicitado: { label: "Solicitado", tone: "violet", icon: <Loader2 className="size-3" /> },
    processando: { label: "Processando", tone: "violet", icon: <Loader2 className="size-3 animate-spin" /> },
    pago: { label: "Pago", tone: "emerald", icon: <CheckCircle2 className="size-3" /> },
    falhou: { label: "Falhou", tone: "rose", icon: <AlertCircle className="size-3" /> },
    cancelado: { label: "Cancelado", tone: "slate", icon: null },
  };
  const cfg = map[status] ?? { label: status, tone: "slate" as const, icon: null };
  return (
    <Pill tone={cfg.tone}>
      {cfg.icon}
      {cfg.label}
    </Pill>
  );
}
