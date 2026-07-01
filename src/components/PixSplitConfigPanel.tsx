import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
const NEXO_MASTER_KEY = "66524872000167";
const NEXO_MASTER_KEY_TYPE = "CNPJ";

export function PixSplitConfigPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agencyKey, setAgencyKey] = useState("");
  const [agencyType, setAgencyType] = useState("CNPJ");
  const [agencyDocument, setAgencyDocument] = useState("");
  

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("agency_settings")
        .select("agency_pix_key, agency_pix_key_type, agency_document")
        .eq("manager_user_id", user.id)
        .maybeSingle();
      setAgencyKey(data?.agency_pix_key ?? "");
      setAgencyType(data?.agency_pix_key_type ?? "CNPJ");
      setAgencyDocument((data as any)?.agency_document ?? "");
      setLoading(false);
    })();
  }, [user?.id]);

  const saveAgency = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("agency_settings")
      .upsert(
        {
          manager_user_id: user.id,
          agency_pix_key: agencyKey.trim() || null,
          agency_pix_key_type: agencyType,
          agency_document: agencyDocument.replace(/\D/g, "") || null,
        } as any,
        { onConflict: "manager_user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Chave Pix de repasse da imobiliária salva.");
  };

  return (
    <Card className="p-6 space-y-5 border-violet-500/30 bg-gradient-to-br from-background to-violet-500/[0.03]">
      <header className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-violet-500/15 text-violet-300">
          <Building2 className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Repasse da Imobiliária</h2>
          <p className="text-sm text-muted-foreground">
            Chave Pix da imobiliária onde será creditada a taxa de administração de cada parcela paga.
          </p>
        </div>
      </header>

      <div className="rounded-lg border bg-card/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Chave Pix da plataforma Nexo
        </div>
        <div className="flex items-center justify-between gap-2">
          <code className="font-mono text-sm">{NEXO_MASTER_KEY}</code>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            {NEXO_MASTER_KEY_TYPE} • fixa
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="py-6 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-[1fr_8rem_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Chave Pix da imobiliária</Label>
            <Input
              value={agencyKey}
              onChange={(e) => setAgencyKey(e.target.value)}
              placeholder="CNPJ, e-mail, telefone ou chave aleatória"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={agencyType} onValueChange={setAgencyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KEY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveAgency} disabled={saving} size="sm">
            {saving && <Loader2 className="size-3.5 mr-2 animate-spin" />}Salvar
          </Button>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">CPF/CNPJ da imobiliária</Label>
            <Input
              value={agencyDocument}
              onChange={(e) => setAgencyDocument(e.target.value)}
              placeholder="Documento titular da chave Pix"
              inputMode="numeric"
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A taxa de administração é repassada via PIX para esta chave assim que o inquilino paga.
      </p>
    </Card>
  );
}
