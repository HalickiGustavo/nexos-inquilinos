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

export const Route = createFileRoute("/landlord-setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chave PIX para recebimento — Proprietário" }] }),
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
        .select("pix_key, pix_key_type, efi_account_number")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pixKeyType, setPixKeyType] = useState<"CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP">("CPF");
  const [pixKey, setPixKey] = useState("");
  const [efiAccountNumber, setEfiAccountNumber] = useState("");

  useEffect(() => {
    if (profile) {
      if (profile.pix_key_type) setPixKeyType(profile.pix_key_type as any);
      if (profile.pix_key) setPixKey(profile.pix_key);
      if ((profile as any).efi_account_number) setEfiAccountNumber((profile as any).efi_account_number);
    }
  }, [profile]);

  if (loading || profileLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user) return;
    if (!pixKey.trim()) return toast.error("Informe a chave PIX para recebimento");
    if (!efiAccountNumber.trim()) return toast.error("Informe o número da sua conta Efí para split nativo");

    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      pix_key: pixKey.trim(),
      pix_key_type: pixKeyType,
      efi_account_number: efiAccountNumber.trim(),
    } as any).eq("id", user.id);
    if (!error) {
      await supabase.from("properties").update({
        owner_pix_key: pixKey.trim(),
        owner_pix_key_type: pixKeyType.toUpperCase(),
      } as any).eq("landlord_id", user.id);
    }
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Chave PIX salva! Os repasses serão depositados nela.");
    navigate({ to: "/landlord", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="max-w-md w-full p-8 space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <Wallet className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Sua chave PIX</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Informe a chave PIX onde os repasses dos seus aluguéis serão depositados.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-emerald-500/5 border-emerald-500/30 p-3 flex gap-2 items-start text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <span>
            <strong>Inquilino paga → NEXO retém taxa → Imobiliária retém repasse → Você recebe o restante via PIX (D+1).</strong>
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo da chave PIX *</Label>
            <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as any)}>
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
            <Input required value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="chave para recebimento" />
          </div>
          <div className="space-y-2">
            <Label>Conta Efí *</Label>
            <Input
              required
              value={efiAccountNumber}
              onChange={(e) => setEfiAccountNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="número da conta Efí"
              inputMode="numeric"
            />
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Salvar e acessar painel
          </Button>
        </form>
      </Card>
    </div>
  );
}
