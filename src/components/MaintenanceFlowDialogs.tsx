import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/queries";
import { formatBRL, parseNumber, today } from "@/lib/format";
import { logMaintenanceEvent } from "@/lib/maintenance-events";

/* ---------- FLUXO 1 · Proprietário executa ---------- */

export function OwnerScheduleDialog({ item }: { item: any }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider_name: item.provider_name ?? "",
    provider_phone: item.provider_phone ?? "",
    scheduled_date: item.scheduled_date ?? "",
    description: item.description ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("maintenances")
      .update({
        provider_name: form.provider_name || null,
        provider_phone: form.provider_phone || null,
        scheduled_date: form.scheduled_date || null,
        description: form.description || null,
        status: "em_andamento",
        workflow_stage: "aguardando_agendamento",
      } as any)
      .eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Execução agendada");
    await logMaintenanceEvent({
      maintenanceId: item.id,
      action: "note",
      actorRole: "owner",
      description: `Execução agendada${form.provider_name ? ` com ${form.provider_name}` : ""}${form.scheduled_date ? ` para ${form.scheduled_date}` : ""}.`,
      metadata: { ...form, stage: "aguardando_agendamento" },
    });
    invalidate(["maintenances"]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1">
          <CalendarClock className="size-3.5 mr-1.5" />
          {item.provider_name ? "Editar agendamento" : "Agendar execução"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar execução</DialogTitle>
          <DialogDescription>
            Registre o prestador e a data prevista para a manutenção.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prestador</Label>
              <Input
                placeholder="Ex.: Encanador João"
                value={form.provider_name}
                onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={form.provider_phone}
                onChange={(e) => setForm({ ...form, provider_phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data prevista</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Salvar agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Conclusão pelo proprietário (Fluxo 1) ou registro final ---------- */

export function OwnerCompleteDialog({ item }: { item: any }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<string[]>(item.invoice_urls ?? []);
  const [photos, setPhotos] = useState<string[]>(item.completion_photo_urls ?? []);
  const [notes, setNotes] = useState<string>(item.final_notes ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("maintenances")
      .update({
        invoice_urls: invoices,
        completion_photo_urls: photos,
        final_notes: notes || null,
        status: "concluido",
        workflow_stage: "concluida",
        completed_date: new Date().toISOString().slice(0, 10),
      } as any)
      .eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Manutenção concluída");
    await logMaintenanceEvent({
      maintenanceId: item.id,
      action: "evidence_added",
      actorRole: "owner",
      description: `Manutenção concluída${invoices.length ? ` — ${invoices.length} nota(s) fiscal(is)` : ""}${photos.length ? ` e ${photos.length} foto(s)` : ""}.`,
      metadata: {
        invoices: invoices.length,
        photos: photos.length,
        stage: "concluida",
      },
    });
    invalidate(["maintenances"]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1">
          <CheckCircle2 className="size-3.5 mr-1.5" />
          Concluir manutenção
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Concluir manutenção</DialogTitle>
          <DialogDescription>
            Anexe nota fiscal (opcional), fotos do serviço e observações finais.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nota fiscal (opcional)</Label>
            <EvidenceUploader value={invoices} onChange={setInvoices} max={4} />
          </div>
          <div className="space-y-2">
            <Label>Fotos do serviço</Label>
            <EvidenceUploader value={photos} onChange={setPhotos} max={8} />
          </div>
          <div className="space-y-2">
            <Label>Observações finais</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Como foi o serviço, garantia, próximos passos…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Marcar como concluída
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- FLUXO 2 · Finalizar pagamento ao inquilino ---------- */

type PaymentMethod = "pix" | "desconto_aluguel" | "outro";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Reembolso via PIX",
  desconto_aluguel: "Descontar no próximo aluguel",
  outro: "Outro método",
};

export function OwnerSettlePaymentDialog({ item }: { item: any }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const budgetAmount = Number(item.budget_amount ?? 0);
  const [form, setForm] = useState<{
    method: PaymentMethod;
    approved: string;
    paid: string;
    date: string;
    notes: string;
  }>({
    method: (item.payment_method as PaymentMethod) ?? "pix",
    approved: String(item.payment_approved_amount ?? budgetAmount ?? ""),
    paid: String(item.payment_paid_amount ?? ""),
    date: item.payment_date ?? new Date().toISOString().slice(0, 10),
    notes: item.payment_notes ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const paid = parseNumber(form.paid);
    if (!paid || paid <= 0) return toast.error("Informe o valor efetivamente pago.");
    setSaving(true);
    try {
      let appliedInstallmentId: string | null = item.payment_applied_installment_id ?? null;

      if (form.method === "desconto_aluguel" && paid > 0) {
        // Encontrar próxima parcela pendente do contrato ativo
        const { data: contracts, error: cErr } = await supabase
          .from("contracts")
          .select("id")
          .eq("property_id", item.property_id)
          .eq("active", true)
          .limit(1);
        if (cErr) throw cErr;
        const contractId = contracts?.[0]?.id;
        if (!contractId) throw new Error("Nenhum contrato ativo neste imóvel.");

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
        if (!next) throw new Error("Nenhuma parcela futura pendente para aplicar o desconto.");

        const newAmount = Math.max(0, Number(next.amount) - paid);
        const noteLine = `Reembolso manutenção #${item.id.slice(0, 6)}: -${formatBRL(paid)}`;
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
          payment_method: form.method,
          payment_approved_amount: parseNumber(form.approved) || null,
          payment_paid_amount: paid,
          payment_date: form.date || null,
          payment_notes: form.notes || null,
          payment_applied_installment_id: appliedInstallmentId,
          status: "concluido",
          workflow_stage: "concluida",
          completed_date: form.date || new Date().toISOString().slice(0, 10),
        } as any)
        .eq("id", item.id);
      if (error) throw error;

      await logMaintenanceEvent({
        maintenanceId: item.id,
        action: form.method === "desconto_aluguel" ? "rent_deduction_applied" : "note",
        actorRole: "owner",
        description: `Pagamento ao inquilino registrado (${METHOD_LABEL[form.method]}): ${formatBRL(paid)}.`,
        metadata: {
          method: form.method,
          approved: parseNumber(form.approved),
          paid,
          date: form.date,
          installment_id: appliedInstallmentId,
        },
      });

      toast.success("Pagamento registrado — manutenção concluída");
      invalidate(["maintenances", "installments"]);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1">
          <Wallet className="size-3.5 mr-1.5" />
          Finalizar & registrar pagamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento ao inquilino</DialogTitle>
          <DialogDescription>
            Escolha a forma de pagamento e informe os valores. A manutenção será marcada como concluída.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Método</Label>
            <Select
              value={form.method}
              onValueChange={(v) => setForm({ ...form, method: v as PaymentMethod })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Reembolso via PIX</SelectItem>
                <SelectItem value="desconto_aluguel">Descontar no próximo aluguel</SelectItem>
                <SelectItem value="outro">Outro método</SelectItem>
              </SelectContent>
            </Select>
            {form.method === "desconto_aluguel" && (
              <p className="text-[11px] text-muted-foreground">
                O valor pago será subtraído da próxima parcela pendente do contrato ativo.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor aprovado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.approved}
                onChange={(e) => setForm({ ...form, approved: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor efetivamente pago (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={form.paid}
                onChange={(e) => setForm({ ...form, paid: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex.: PIX enviado para chave do inquilino."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Registrar e concluir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
