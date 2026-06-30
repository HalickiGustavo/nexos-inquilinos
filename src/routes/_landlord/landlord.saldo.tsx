import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, ArrowDownToLine, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_landlord/landlord/saldo")({
  head: () => ({ meta: [{ title: "Saldo e Saque — Proprietário NEXO" }] }),
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
  const [efiAccountNumber, setEfiAccountNumber] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Hidrata o form com o que está salvo no profile
  const effectiveKey = pixKey || profile?.pix_key || "";
  const effectiveType = (pixKey ? pixType : (profile?.pix_key_type as PixKeyType)) || "cpf";

  async function savePix() {
    if (!user?.id) return;
    const nextPixKey = pixKey.trim() || profile?.pix_key || "";
    const nextEfiAccount = efiAccountNumber.trim() || (profile as any)?.efi_account_number || "";
    if (!nextPixKey) { toast.error("Informe a chave PIX."); return; }
    if (!nextEfiAccount) { toast.error("Informe a conta Efí para split nativo."); return; }
    setSavingKey(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({
          pix_key: nextPixKey,
          pix_key_type: pixType,
          efi_account_number: nextEfiAccount,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Chave PIX salva!");
      qc.invalidateQueries({ queryKey: ["landlord", "profile"] });
      setPixKey("");
      setEfiAccountNumber("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    } finally {
      setSavingKey(false);
    }
  }

  async function requestWithdrawal() {
    if (!user?.id) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { toast.error("Valor inválido."); return; }
    if (value > saldoDisponivel) { toast.error("Valor maior que o saldo disponível."); return; }
    if (!profile?.pix_key) { toast.error("Cadastre uma chave PIX antes de solicitar saque."); return; }

    setSubmitting(true);
    try {
      // Descobre o manager pelo primeiro imóvel vinculado (RLS limita aos próprios)
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
      setOpen(false); setAmount("");
      qc.invalidateQueries({ queryKey: ["landlord", "withdrawals"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar saque.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Saldo e Saque</h1>
        <p className="text-muted-foreground mt-1">
          Saldo derivado dos repasses recebidos via integração Asaas. Saques via PIX cadastrado.
        </p>
      </header>

      {/* Saldo principal */}
      <Card className="p-6 border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
              <Coins className="size-3.5" /> Saldo disponível
            </div>
            <p className="text-4xl font-bold tabular-nums mt-2">
              {loading ? "—" : formatBRL(saldoDisponivel)}
            </p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>Recebido: <strong className="text-foreground">{formatBRL(totalRecebido)}</strong></span>
              <span>Já sacado/solicitado: <strong className="text-foreground">{formatBRL(totalSacado)}</strong></span>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={saldoDisponivel <= 0 || !profile?.pix_key}
                className="bg-emerald-500 hover:bg-emerald-400 text-white">
                <ArrowDownToLine className="size-4 mr-2" />
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
                <Input type="number" step="0.01" min="0" max={saldoDisponivel}
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00" />
                <p className="text-xs text-muted-foreground">
                  Máximo: <strong>{formatBRL(saldoDisponivel)}</strong>
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={requestWithdrawal} disabled={submitting}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white">
                  {submitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ArrowDownToLine className="size-4 mr-2" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* PIX cadastrado / editar */}
      <Card className="p-5">
        <h2 className="font-semibold inline-flex items-center gap-2 mb-1">
          <KeyRound className="size-4" /> Chave PIX para saque
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {profile?.pix_key
            ? <>Chave atual: <strong className="text-foreground">{profile.pix_key}</strong> ({profile.pix_key_type}) • Conta Efí: <strong className="text-foreground">{(profile as any).efi_account_number || "não cadastrada"}</strong></>
            : "Você ainda não cadastrou uma chave PIX."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_160px_auto] gap-2">
          <Select value={effectiveType} onValueChange={(v) => setPixType(v as PixKeyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Aleatória</SelectItem>
            </SelectContent>
          </Select>
          <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)}
            placeholder={profile?.pix_key || "Digite a nova chave"} />
          <Input
            value={efiAccountNumber}
            onChange={(e) => setEfiAccountNumber(e.target.value.replace(/\D/g, ""))}
            placeholder={(profile as any)?.efi_account_number || "Conta Efí"}
            inputMode="numeric"
          />
          <Button onClick={savePix} disabled={savingKey || (!pixKey.trim() && !efiAccountNumber.trim())}>
            {savingKey ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          O split nativo da Efí exige que o proprietário tenha uma conta Efí; a chave Pix sozinha não basta para dividir na liquidação.
        </p>
      </Card>

      {/* Histórico de saques */}
      <Card className="p-5">
        <h2 className="font-semibold mb-4">Histórico de saques</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum saque solicitado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(withdrawals as any[]).map((w) => (
              <li key={w.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium tabular-nums">{formatBRL(Number(w.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(w.requested_at)} • {w.pix_key} ({w.pix_key_type})
                  </p>
                </div>
                <WithdrawalStatus status={w.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function WithdrawalStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; icon: React.ReactNode }> = {
    solicitado: { label: "Solicitado", cn: "border-violet-500/40 text-violet-300", icon: <Loader2 className="size-3" /> },
    processando: { label: "Processando", cn: "border-violet-500/40 text-violet-300", icon: <Loader2 className="size-3 animate-spin" /> },
    pago: { label: "Pago", cn: "border-emerald-500/40 text-emerald-300", icon: <CheckCircle2 className="size-3" /> },
    falhou: { label: "Falhou", cn: "border-rose-500/40 text-rose-300", icon: <AlertCircle className="size-3" /> },
    cancelado: { label: "Cancelado", cn: "border-zinc-700 text-zinc-400", icon: null },
  };
  const cfg = map[status] ?? { label: status, cn: "border-zinc-700 text-zinc-300", icon: null };
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 ${cfg.cn}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}
