import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, Building2, Home, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";

const KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;

function KeyTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || "EVP"} onValueChange={onChange}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        {KEY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function PixSplitConfigPanel() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Agency
  const [agencyKey, setAgencyKey] = useState("");
  const [agencyType, setAgencyType] = useState("EVP");

  // Properties
  const [properties, setProperties] = useState<any[]>([]);

  // Platform (admin only — via has_role manager + nexo_platform_pix_key, but we let
  // managers see it too if they have access via platform_settings policy).
  const [nexoKey, setNexoKey] = useState("");
  const [nexoType, setNexoType] = useState("EVP");
  const [nexoFee, setNexoFee] = useState("24.99");
  const isManager = role === "manager";

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const [ag, props, settings] = await Promise.all([
        supabase.from("agency_settings").select("agency_pix_key, agency_pix_key_type").eq("manager_user_id", user.id).maybeSingle(),
        supabase.from("properties").select("id, nickname, owner_pix_key, owner_pix_key_type").eq("user_id", user.id).order("nickname"),
        isManager ? supabase.from("platform_settings").select("key, value").in("key", ["nexo_platform_pix_key", "nexo_platform_pix_key_type", "nexo_flat_fee"]) : Promise.resolve({ data: [] as any[] }),
      ]);
      setAgencyKey(ag.data?.agency_pix_key ?? "");
      setAgencyType(ag.data?.agency_pix_key_type ?? "EVP");
      setProperties(props.data ?? []);
      const map: Record<string, string> = {};
      (settings.data ?? []).forEach((r: any) => (map[r.key] = r.value));
      if (map.nexo_platform_pix_key !== undefined) setNexoKey(map.nexo_platform_pix_key);
      if (map.nexo_platform_pix_key_type) setNexoType(map.nexo_platform_pix_key_type);
      if (map.nexo_flat_fee) setNexoFee(map.nexo_flat_fee);
      setLoading(false);
    })();
  }, [user?.id, isManager]);

  const saveAgency = async () => {
    if (!user?.id) return;
    setSaving("agency");
    const { error } = await supabase
      .from("agency_settings")
      .upsert({
        manager_user_id: user.id,
        agency_pix_key: agencyKey.trim() || null,
        agency_pix_key_type: agencyType,
      } as any, { onConflict: "manager_user_id" });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Chave Pix da imobiliária salva.");
  };

  const saveProperty = async (id: string, key: string, keyType: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("properties")
      .update({ owner_pix_key: key.trim() || null, owner_pix_key_type: keyType } as any)
      .eq("id", id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Chave Pix do proprietário salva.");
  };

  const savePlatform = async () => {
    setSaving("platform");
    const rows = [
      { key: "nexo_platform_pix_key", value: nexoKey.trim(), description: "Chave Pix da plataforma Nexo" },
      { key: "nexo_platform_pix_key_type", value: nexoType, description: "Tipo da chave Pix Nexo" },
      { key: "nexo_flat_fee", value: String(Number(nexoFee || 0)), description: "Taxa fixa Nexo por parcela (R$)" },
    ];
    const { error } = await supabase.from("platform_settings").upsert(rows as any, { onConflict: "key" });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Configuração da plataforma salva.");
  };

  const allConfigured = useMemo(() => {
    return !!agencyKey.trim() && properties.some((p) => p.owner_pix_key);
  }, [agencyKey, properties]);

  return (
    <Card className="p-6 space-y-6 border-violet-500/30 bg-gradient-to-br from-background to-violet-500/[0.03]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-violet-500/15 text-violet-300">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Pix Split — 3 vias (sem subconta)</h2>
            <p className="text-sm text-muted-foreground">
              Configure as chaves Pix da Nexo, da imobiliária e de cada proprietário. O QR Code do inquilino divide automaticamente o valor entre os três destinos.
            </p>
          </div>
        </div>
        {allConfigured && (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 border">
            Pronto
          </Badge>
        )}
      </header>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {isManager && (
            <section className="space-y-3 rounded-lg border bg-card/40 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-violet-300" />
                <h3 className="font-medium text-sm">Plataforma Nexo (admin)</h3>
              </div>
              <div className="grid sm:grid-cols-[1fr_8rem_8rem_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Chave Pix Nexo</Label>
                  <Input value={nexoKey} onChange={(e) => setNexoKey(e.target.value)} placeholder="chave Pix recebedora da Nexo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <KeyTypeSelect value={nexoType} onChange={setNexoType} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fee fixo (R$)</Label>
                  <Input value={nexoFee} onChange={(e) => setNexoFee(e.target.value)} inputMode="decimal" />
                </div>
                <Button onClick={savePlatform} disabled={saving === "platform"} size="sm">
                  {saving === "platform" && <Loader2 className="size-3.5 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            </section>
          )}

          <section className="space-y-3 rounded-lg border bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-violet-300" />
              <h3 className="font-medium text-sm">Imobiliária (taxa de administração)</h3>
            </div>
            <div className="grid sm:grid-cols-[1fr_8rem_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Chave Pix da imobiliária</Label>
                <Input value={agencyKey} onChange={(e) => setAgencyKey(e.target.value)} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <KeyTypeSelect value={agencyType} onChange={setAgencyType} />
              </div>
              <Button onClick={saveAgency} disabled={saving === "agency"} size="sm">
                {saving === "agency" && <Loader2 className="size-3.5 mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <Home className="size-4 text-violet-300" />
              <h3 className="font-medium text-sm">Proprietários por imóvel</h3>
            </div>
            {properties.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum imóvel cadastrado ainda.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {properties.map((p) => (
                  <PropertyRow key={p.id} property={p} saving={saving === p.id} onSave={saveProperty} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Card>
  );
}

function PropertyRow({
  property,
  saving,
  onSave,
}: {
  property: any;
  saving: boolean;
  onSave: (id: string, key: string, type: string) => void;
}) {
  const [key, setKey] = useState(property.owner_pix_key ?? "");
  const [type, setType] = useState(property.owner_pix_key_type ?? "EVP");
  return (
    <div className="grid sm:grid-cols-[1fr_1fr_8rem_auto] gap-2 items-end border-b last:border-0 pb-2">
      <div className="text-sm font-medium truncate" title={property.nickname}>{property.nickname}</div>
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Chave Pix do proprietário" />
      <KeyTypeSelect value={type} onChange={setType} />
      <Button size="sm" variant="outline" disabled={saving} onClick={() => onSave(property.id, key, type)}>
        {saving && <Loader2 className="size-3.5 mr-2 animate-spin" />}Salvar
      </Button>
    </div>
  );
}
