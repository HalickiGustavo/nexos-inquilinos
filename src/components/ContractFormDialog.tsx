import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useInvalidate, useProperties, useTenants } from "@/lib/queries";
import { parseNumber } from "@/lib/format";

export function ContractFormDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const { data: properties = [] } = useProperties();
  const { data: tenants = [] } = useTenants();

  const today = new Date().toISOString().slice(0, 10);
  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    start_date: today,
    end_date: oneYear.toISOString().slice(0, 10),
    due_day: "5",
    rent_amount: "",
    readjustment_index: "IGP-M",
    security_deposit: "0",
    late_fee_percent: "2",
    daily_interest_percent: "0.033",
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo contrato</DialogTitle>
      </DialogHeader>
      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user || submitting) return;
          setSubmitting(true);
          try {
            const payload = {
              user_id: user.id,
              property_id: form.property_id,
              tenant_id: form.tenant_id,
              start_date: form.start_date,
              end_date: form.end_date,
              due_day: parseInt(form.due_day),
              rent_amount: parseNumber(form.rent_amount),
              readjustment_index: form.readjustment_index as any,
              security_deposit: parseNumber(form.security_deposit),
              late_fee_percent: parseNumber(form.late_fee_percent),
              daily_interest_percent: parseNumber(form.daily_interest_percent),
              active: true,
            };
            const { error } = await supabase.from("contracts").insert(payload);
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success("Contrato criado e parcelas geradas!");
            invalidate();
            onDone();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label>Imóvel *</Label>
          <Select
            value={form.property_id}
            onValueChange={(v) => {
              const prop = properties.find((p) => p.id === v);
              setForm({
                ...form,
                property_id: v,
                rent_amount: prop ? String(prop.rent_price) : form.rent_amount,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um imóvel" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nickname} — {p.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Inquilino *</Label>
          <Select
            value={form.tenant_id}
            onValueChange={(v) => setForm({ ...form, tenant_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um inquilino" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Início *</Label>
          <Input
            type="date"
            required
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Fim *</Label>
          <Input
            type="date"
            required
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Dia de vencimento (1-31) *</Label>
          <Input
            type="number"
            min={1}
            max={31}
            required
            value={form.due_day}
            onChange={(e) => setForm({ ...form, due_day: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Valor do aluguel (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            required
            value={form.rent_amount}
            onChange={(e) => setForm({ ...form, rent_amount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Índice de reajuste</Label>
          <Select
            value={form.readjustment_index}
            onValueChange={(v) => setForm({ ...form, readjustment_index: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IGP-M">IGP-M</SelectItem>
              <SelectItem value="IPCA">IPCA</SelectItem>
              <SelectItem value="INCC">INCC</SelectItem>
              <SelectItem value="nenhum">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Caução (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.security_deposit}
            onChange={(e) =>
              setForm({ ...form, security_deposit: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Multa por atraso (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.late_fee_percent}
            onChange={(e) =>
              setForm({ ...form, late_fee_percent: e.target.value })
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Juros ao dia (%)</Label>
          <Input
            type="number"
            step="0.001"
            value={form.daily_interest_percent}
            onChange={(e) =>
              setForm({ ...form, daily_interest_percent: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            0,033% ao dia ≈ 1% ao mês
          </p>
        </div>

        <DialogFooter className="sm:col-span-2">
          <Button
            type="submit"
            disabled={submitting || !form.property_id || !form.tenant_id}
          >
            {submitting ? "Criando..." : "Criar contrato e gerar parcelas"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
