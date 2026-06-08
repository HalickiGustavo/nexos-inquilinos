import { useMemo, useState } from "react";
import { AlertTriangle, Handshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useInvalidate } from "@/lib/queries";
import { formatBRL, formatDate, today } from "@/lib/format";

type OverdueInstallment = {
  id: string;
  contract_id: string;
  amount: number | string;
  extra_fees: number | string;
  due_date: string;
};

export function DebtAgreementDialog({
  open, onOpenChange, tenantId, tenantName, overdue,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  tenantName: string;
  overdue: OverdueInstallment[];
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();

  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(overdue.map((i) => [i.id, true])),
  );
  const [lateFee, setLateFee] = useState("10");
  const [interest, setInterest] = useState("5");
  const [count, setCount] = useState("3");
  const [firstDue, setFirstDue] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const chosen = overdue.filter((i) => selected[i.id]);
  const contractId = chosen[0]?.contract_id;
  const mixedContracts = chosen.some((i) => i.contract_id !== contractId);

  const subtotal = useMemo(
    () => chosen.reduce((s, i) => s + Number(i.amount || 0) + Number(i.extra_fees || 0), 0),
    [chosen],
  );
  const lateFeePct = Number(lateFee) || 0;
  const interestPct = Number(interest) || 0;
  const installmentsCount = Math.max(1, Math.min(36, Number(count) || 1));
  const total = subtotal * (1 + lateFeePct / 100) * (1 + interestPct / 100);
  const perInstallment = total / installmentsCount;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function submit() {
    if (!user) return;
    if (chosen.length === 0) return toast.error("Selecione ao menos uma parcela atrasada.");
    if (mixedContracts) return toast.error("Selecione parcelas de um único contrato.");
    if (!firstDue) return toast.error("Informe a data do primeiro vencimento.");

    setSaving(true);
    try {
      // 1) Criar o acordo
      const { data: agreement, error: aerr } = await (supabase as any)
        .from("debt_agreements")
        .insert({
          user_id: user.id,
          contract_id: contractId,
          tenant_id: tenantId,
          original_total: subtotal.toFixed(2),
          late_fee_percent: lateFeePct,
          interest_percent: interestPct,
          installments_count: installmentsCount,
          total_amount: total.toFixed(2),
          first_due_date: firstDue,
          notes: notes || null,
        })
        .select()
        .single();
      if (aerr) throw aerr;

      // 2) Marcar parcelas antigas como acordo_fechado
      const ids = chosen.map((i) => i.id);
      const { error: uerr } = await (supabase as any)
        .from("installments")
        .update({ status: "acordo_fechado", debt_agreement_id: agreement.id })
        .in("id", ids);
      if (uerr) throw uerr;

      // 3) Gerar novas parcelas
      const newInstallments = Array.from({ length: installmentsCount }, (_, idx) => {
        const d = new Date(firstDue + "T00:00:00");
        d.setMonth(d.getMonth() + idx);
        return {
          user_id: user.id,
          contract_id: contractId,
          due_date: d.toISOString().slice(0, 10),
          amount: perInstallment.toFixed(2),
          status: "pendente",
          debt_agreement_id: agreement.id,
          notes: `Parcela ${idx + 1}/${installmentsCount} do acordo de renegociação`,
        };
      });
      const { error: ierr } = await (supabase as any)
        .from("installments")
        .insert(newInstallments);
      if (ierr) throw ierr;

      toast.success("Acordo criado e novas parcelas geradas.");
      invalidate(["installments"]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar o acordo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="size-5 text-violet-400" />
            Criar Acordo de Dívida
          </DialogTitle>
          <DialogDescription>
            Renegociação para <span className="font-medium text-foreground">{tenantName}</span>.
            As parcelas selecionadas serão marcadas como <Badge variant="outline">Acordo Fechado</Badge>{" "}
            e substituídas pelo novo parcelamento.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de atrasadas */}
        <div className="space-y-2 max-h-56 overflow-y-auto rounded-lg border p-2">
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Nenhuma parcela atrasada para este inquilino.
            </p>
          ) : (
            overdue.map((i) => {
              const totalI = Number(i.amount || 0) + Number(i.extra_fees || 0);
              return (
                <label
                  key={i.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={!!selected[i.id]}
                    onCheckedChange={() => toggle(i.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{formatBRL(totalI)}</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento {formatDate(i.due_date)}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    Atrasado
                  </Badge>
                </label>
              );
            })
          )}
        </div>

        {mixedContracts && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Selecione parcelas de um único contrato por acordo.
          </p>
        )}

        {/* Parâmetros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Multa (%)</Label>
            <Input
              type="number" step="0.5" min="0"
              value={lateFee} onChange={(e) => setLateFee(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Juros (%)</Label>
            <Input
              type="number" step="0.5" min="0"
              value={interest} onChange={(e) => setInterest(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nº de parcelas</Label>
            <Input
              type="number" min="1" max="36"
              value={count} onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>1º vencimento</Label>
            <Input
              type="date" min={today()}
              value={firstDue} onChange={(e) => setFirstDue(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            rows={2}
            placeholder="Termos negociados, contato, etc."
            value={notes} onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Resumo */}
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-1 text-sm">
          <Row label="Subtotal selecionado" value={formatBRL(subtotal)} />
          <Row label={`Acréscimo (multa ${lateFeePct}% + juros ${interestPct}%)`} value={formatBRL(total - subtotal)} />
          <div className="border-t border-violet-500/20 my-1" />
          <Row label="Total renegociado" value={formatBRL(total)} bold />
          <Row
            label={`${installmentsCount}x de`}
            value={formatBRL(perInstallment)}
            highlight
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={saving || chosen.length === 0 || mixedContracts}
            className="bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_-6px_rgb(168_85_247)]"
          >
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Handshake className="size-4 mr-2" />}
            Fechar acordo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={
        (bold ? "font-semibold " : "") +
        (highlight ? "text-violet-400 font-bold tabular-nums" : "tabular-nums")
      }>
        {value}
      </span>
    </div>
  );
}
