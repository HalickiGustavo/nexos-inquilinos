import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { maskCpfCnpj, isValidCPF, isValidCNPJ, onlyDigits } from "@/lib/br-validators";

export const Route = createFileRoute("/landlord-setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dados para recebimento — Proprietário" }] }),
  component: LandlordSetup,
});

function LandlordSetup() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["landlord-setup-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, document, document_type, pix_key, pix_key_type, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    document: "",
    phone: "",
    pix_key_type: "CPF" as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
    pix_key: "",
  });

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        full_name: profile.full_name ?? f.full_name,
        document: profile.document ?? f.document,
        phone: profile.phone ?? f.phone,
        pix_key_type: (profile.pix_key_type as any) ?? f.pix_key_type,
        pix_key: profile.pix_key ?? f.pix_key,
      }));
    }
  }, [profile]);

  if (loading || profileLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const docDigits = onlyDigits(form.document);
  const docValid = docDigits.length === 11 ? isValidCPF(docDigits) : docDigits.length === 14 ? isValidCNPJ(docDigits) : false;
  const docType = docDigits.length === 14 ? "CNPJ" : "CPF";

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user) return;
    if (!form.full_name.trim()) return toast.error("Informe o nome completo");
    if (!docValid) return toast.error("CPF/CNPJ inválido");
    if (!form.pix_key.trim()) return toast.error("Informe a chave PIX para recebimento");

    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(),
      document: docDigits,
      document_type: docType,
      phone: form.phone || null,
      pix_key: form.pix_key.trim(),
      pix_key_type: form.pix_key_type,
    } as any).eq("id", user.id);
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Dados de recebimento salvos! Os repasses serão depositados no seu PIX.");
    navigate({ to: "/landlord", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="max-w-xl w-full p-8 space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <Wallet className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Dados para receber seus aluguéis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Para que a imobiliária possa fazer o repasse diário automático via PIX, precisamos do seu CPF/CNPJ e da chave PIX onde os valores líquidos serão depositados.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-emerald-500/5 border-emerald-500/30 p-3 flex gap-2 items-start text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <span>
            Fluxo: <strong>Inquilino paga → NEXO retém sua taxa → Imobiliária retém o repasse acordado → Você recebe o restante via PIX (D+1).</strong>
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-2">
            <Label>Nome completo *</Label>
            <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ *</Label>
            <Input
              required
              value={form.document}
              onChange={(e) => setForm({ ...form, document: maskCpfCnpj(e.target.value) })}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            {form.document && !docValid && <p className="text-[11px] text-destructive">Documento inválido</p>}
          </div>
          <div className="space-y-2">
            <Label>Telefone (WhatsApp)</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 90000-0000" />
          </div>
          <div className="space-y-2">
            <Label>Tipo da chave PIX *</Label>
            <Select value={form.pix_key_type} onValueChange={(v) => setForm({ ...form, pix_key_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="EVP">Chave aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chave PIX *</Label>
            <Input required value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="chave para recebimento" />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              Salvar e acessar painel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
