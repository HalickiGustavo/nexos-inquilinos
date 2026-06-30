import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatória" },
] as const;
type KeyType = typeof KEY_TYPES[number]["value"];

export function OwnerPixKeyPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<KeyType>("cpf");
  const [efiAccountNumber, setEfiAccountNumber] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("pix_key, pix_key_type, efi_account_number")
        .eq("id", user.id)
        .maybeSingle();
      setPixKey(data?.pix_key ?? "");
      if (data?.pix_key_type) setPixKeyType(data.pix_key_type as any);
      setEfiAccountNumber((data as any)?.efi_account_number ?? "");
      setLoading(false);
    })();
  }, [user?.id]);

  const save = async () => {
    if (!user?.id) return;
    if (!pixKey.trim()) return toast.error("Informe sua chave PIX para receber os repasses.");
    if (!efiAccountNumber.trim()) return toast.error("Informe o número da sua conta Efí para usar split nativo.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pix_key: pixKey.trim(), pix_key_type: pixKeyType, efi_account_number: efiAccountNumber.trim() } as any)
      .eq("id", user.id);
    if (!error) {
      // Propaga para todos os imóveis vinculados (autônomo: user_id; convidado: landlord_id)
      await supabase.from("properties").update({
        owner_pix_key: pixKey.trim(),
        owner_pix_key_type: pixKeyType.toUpperCase(),
      } as any).or(`user_id.eq.${user.id},landlord_id.eq.${user.id}`);
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Chave PIX salva. Os repasses serão depositados nela.");
  };

  return (
    <Card className="p-6 space-y-4 border-emerald-500/30 bg-gradient-to-br from-background to-emerald-500/[0.03]">
      <header className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400">
          <Wallet className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Sua chave PIX para recebimento</h2>
          <p className="text-sm text-muted-foreground">
            Os aluguéis pagos pelos inquilinos são repassados automaticamente via PIX (D+1) para esta chave.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="py-6 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-[8rem_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KEY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chave PIX</Label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Conta Efí</Label>
              <Input
                value={efiAccountNumber}
                onChange={(e) => setEfiAccountNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="Número da conta Efí do proprietário"
                inputMode="numeric"
              />
            </div>
            <Button onClick={save} disabled={saving} size="sm">
              {saving && <Loader2 className="size-3.5 mr-2 animate-spin" />}Salvar
            </Button>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 mt-0.5 text-emerald-500 shrink-0" />
            <span>Para split nativo Efí, o favorecido precisa ter uma conta Efí; a chave Pix sozinha não é aceita pela API de split.</span>
          </div>
        </>
      )}
    </Card>
  );
}
