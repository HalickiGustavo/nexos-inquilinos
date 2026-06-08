import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/queries";
import { formatBRL, formatDate, parseNumber, today } from "@/lib/format";

export type BudgetStatus = "nenhum" | "pendente" | "aprovado" | "recusado";

const STATUS_LABEL: Record<BudgetStatus, string> = {
  nenhum: "Sem orçamento",
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const STATUS_STYLE: Record<BudgetStatus, string> = {
  nenhum: "bg-muted text-muted-foreground",
  pendente: "bg-amber-500 text-white",
  aprovado: "bg-primary text-primary-foreground",
  recusado: "bg-destructive text-destructive-foreground",
};

export function MaintenanceBudgetPanel({ item }: { item: any }) {
  const status = (item.budget_status ?? "nenhum") as BudgetStatus;
  const [submitOpen, setSubmitOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Receipt className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Orçamento:</span>
          <Badge className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        {status !== "nenhum" && (
          <span className="text-sm font-semibold">{formatBRL(Number(item.budget_amount))}</span>
        )}
      </div>

      {item.budget_notes && (
        <p className="text-xs text-muted-foreground italic">"{item.budget_notes}"</p>
      )}
      {status === "aprovado" && item.budget_rent_deduction && (
        <p className="text-xs text-primary">
          ✓ Abatimento aplicado no próximo aluguel
        </p>
      )}
      {item.budget_decided_at && (
        <p className="text-[10px] text-muted-foreground">
          Decidido em {formatDate(item.budget_decided_at)}
        </p>
      )}

      <div className="flex gap-2">
        {(status === "nenhum" || status === "recusado") && (
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setSubmitOpen(true)}>
            <Receipt className="size-3.5 mr-1.5" />
            {status === "recusado" ? "Novo orçamento" : "Registrar orçamento"}
          </Button>
        )}
        {status === "pendente" && (
          <Button size="sm" className="flex-1" onClick={() => setDecideOpen(true)}>
            Analisar orçamento
          </Button>
        )}
      </div>

      {submitOpen && (
        <SubmitBudgetDialog item={item} open={submitOpen} onOpenChange={setSubmitOpen} />
      )}
      {decideOpen && (
        <DecideBudgetDialog item={item} open={decideOpen} onOpenChange={setDecideOpen} />
      )}
    </div>
  );
}

function SubmitBudgetDialog({
  item,
  open,
  onOpenChange,
}: {
  item: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const invalidate = useInvalidate();
  const [amount, setAmount] = useState(item.budget_amount ? String(item.budget_amount) : "");
  const [notes, setNotes] = useState(item.budget_notes ?? "");
  const [provider, setProvider] = useState(item.provider_name ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("maintenances")
      .update({
        budget_amount: parseNumber(amount),
        budget_notes: notes || null,
        provider_name: provider || null,
        budget_status: "pendente",
        budget_decided_at: null,
        budget_rent_deduction: false,
        budget_applied_installment_id: null,
      } as any)
      .eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Orçamento enviado ao proprietário");
    invalidate(["maintenances"]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar orçamento</DialogTitle>
          <DialogDescription>
            Informe o valor do orçamento da manutenção. O proprietário será notificado para aprovar ou recusar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Valor do orçamento (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Prestador / fornecedor</Label>
            <Input
              placeholder="Ex.: Encanador João"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              placeholder="Escopo do serviço, validade do orçamento…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !amount}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Enviar para o proprietário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecideBudgetDialog({
  item,
  open,
  onOpenChange,
}: {
  item: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const invalidate = useInvalidate();
  const [deduct, setDeduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const amount = Number(item.budget_amount ?? 0);

  async function applyDecision(decision: "aprovado" | "recusado") {
    setBusy(true);
    try {
      let appliedInstallmentId: string | null = null;

      if (decision === "aprovado" && deduct && amount > 0) {
        // Encontrar a próxima parcela pendente do contrato ativo deste imóvel
        const { data: contracts, error: cErr } = await supabase
          .from("contracts")
          .select("id")
          .eq("property_id", item.property_id)
          .eq("active", true)
          .limit(1);
        if (cErr) throw cErr;
        const contractId = contracts?.[0]?.id;
        if (!contractId) {
          throw new Error("Nenhum contrato ativo encontrado para este imóvel.");
        }

        const { data: nextInstallments, error: iErr } = await supabase
          .from("installments")
          .select("id, amount, notes")
          .eq("contract_id", contractId)
          .eq("status", "pendente")
          .gte("due_date", today())
          .order("due_date", { ascending: true })
          .limit(1);
        if (iErr) throw iErr;
        const next = nextInstallments?.[0];
        if (!next) {
          throw new Error("Nenhuma parcela futura pendente para aplicar o abatimento.");
        }

        const newAmount = Math.max(0, Number(next.amount) - amount);
        const noteLine = `Abatimento manutenção #${item.id.slice(0, 6)}: -${formatBRL(amount)}`;
        const mergedNotes = next.notes ? `${next.notes}\n${noteLine}` : noteLine;
        const { error: uErr } = await supabase
          .from("installments")
          .update({ amount: newAmount, notes: mergedNotes })
          .eq("id", next.id);
        if (uErr) throw uErr;
        appliedInstallmentId = next.id;
      }

      const { error } = await supabase
        .from("maintenances")
        .update({
          budget_status: decision,
          budget_rent_deduction: decision === "aprovado" ? deduct : false,
          budget_decided_at: new Date().toISOString(),
          budget_applied_installment_id: appliedInstallmentId,
        })
        .eq("id", item.id);
      if (error) throw error;

      toast.success(
        decision === "aprovado"
          ? deduct
            ? "Orçamento aprovado — abatimento aplicado!"
            : "Orçamento aprovado!"
          : "Orçamento recusado.",
      );
      invalidate(["maintenances", "installments"]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao decidir orçamento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analisar orçamento</DialogTitle>
          <DialogDescription>
            Valor proposto: <strong>{formatBRL(amount)}</strong>
            {item.budget_notes ? ` — "${item.budget_notes}"` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {item.provider_name && (
            <p className="text-xs text-muted-foreground">
              Prestador indicado: <span className="font-medium text-foreground">{item.provider_name}</span>
            </p>
          )}
          {item.evidence_urls?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Evidências do inquilino</p>
              <EvidenceGrid paths={item.evidence_urls} />
            </div>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={deduct}
              onCheckedChange={(v) => setDeduct(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium">Abater no próximo aluguel</span>
              <span className="block text-xs text-muted-foreground">
                Ao aprovar, o valor será subtraído da próxima parcela pendente do inquilino.
              </span>
            </span>
          </label>
        </div>


        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => applyDecision("recusado")}
          >
            <XCircle className="size-4 mr-2" />
            Recusar
          </Button>
          <Button disabled={busy} onClick={() => applyDecision("aprovado")}>
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
