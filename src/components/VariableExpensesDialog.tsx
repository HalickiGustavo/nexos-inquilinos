import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate, parseNumber } from "@/lib/format";
import {
  parseExpenses,
  expensesTotals,
  type VariableExpense,
  type ExpensePayer,
  PAYER_LABEL,
} from "@/lib/variable-expenses";

type Props = {
  installment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function VariableExpensesDialog({ installment, open, onOpenChange, onSaved }: Props) {
  const initial = parseExpenses(installment?.variable_expenses);
  const [items, setItems] = useState<VariableExpense[]>(initial);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState<ExpensePayer>("inquilino");
  const [saving, setSaving] = useState(false);

  const totals = expensesTotals(items);
  const rent = Number(installment?.amount ?? 0);
  const tenantDue = rent + totals.tenant;

  const add = () => {
    const a = parseNumber(amount);
    if (!desc.trim()) return toast.error("Informe a descrição");
    if (a <= 0) return toast.error("Valor inválido");
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: desc.trim(), amount: a, payer, created_at: new Date().toISOString() },
    ]);
    setDesc("");
    setAmount("");
    setPayer("inquilino");
  };

  const remove = (id: string) => setItems((prev) => prev.filter((e) => e.id !== id));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("installments")
      .update({ variable_expenses: items as any } as any)
      .eq("id", installment.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Despesas atualizadas");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Despesas variáveis</DialogTitle>
          <DialogDescription>
            Parcela com vencimento em {formatDate(installment?.due_date)} — aluguel {formatBRL(rent)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5 space-y-1">
              <Label>Descrição</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: água, gás, condomínio" />
            </div>
            <div className="col-span-3 space-y-1">
              <Label>Valor (R$)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </div>
            <div className="col-span-3 space-y-1">
              <Label>Responsável</Label>
              <Select value={payer} onValueChange={(v) => setPayer(v as ExpensePayer)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquilino">{PAYER_LABEL.inquilino}</SelectItem>
                  <SelectItem value="proprietario">{PAYER_LABEL.proprietario}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Button type="button" onClick={add} size="icon" aria-label="Adicionar"><Plus className="size-4" /></Button>
            </div>
          </div>

          <div className="border rounded-md divide-y">
            {items.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">Sem despesas variáveis para esta parcela.</p>
            )}
            {items.map((e) => (
              <div key={e.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-xs text-muted-foreground">{PAYER_LABEL[e.payer]}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={e.payer === "inquilino" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-primary/40 text-primary"}>
                    {e.payer === "inquilino" ? "+" : "−"} {formatBRL(e.amount)}
                  </Badge>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(e.id)} aria-label="Remover">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Aluguel base</p>
              <p className="font-semibold">{formatBRL(rent)}</p>
            </div>
            <div className="rounded-md bg-amber-500/10 p-3">
              <p className="text-xs text-muted-foreground">+ Cobrança inquilino</p>
              <p className="font-semibold">{formatBRL(totals.tenant)}</p>
            </div>
            <div className="rounded-md bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">− Desconto proprietário</p>
              <p className="font-semibold">{formatBRL(totals.owner)}</p>
            </div>
          </div>

          <p className="text-sm">
            Total devido pelo inquilino: <span className="font-bold">{formatBRL(tenantDue)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar despesas"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
