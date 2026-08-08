import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useInvalidate, type Property } from "@/lib/queries";
import { parseNumber } from "@/lib/format";
import { maskCEP } from "@/lib/br-validators";
import { PropertyPhotosUploader } from "@/components/PropertyPhotosUploader";

type Mode = "owner" | "manager";

export function PropertyFormDialog({
  editing,
  onDone,
  mode = "owner",
  invalidateKeys,
}: {
  editing: Property | null;
  onDone: () => void;
  mode?: Mode;
  invalidateKeys?: string[];
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();

  const { data: integ } = useQuery({
    queryKey: ["profile-integrations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("integration_imovelweb_connected, integration_zap_connected")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        imw: Boolean(data?.integration_imovelweb_connected),
        zap: Boolean(data?.integration_zap_connected),
      };
    },
  });
  const imwConnected = !!integ?.imw;
  const zapConnected = !!integ?.zap;

  // Proprietários cadastrados (landlords que aceitaram o convite desta imobiliária ou já estavam vinculados)
  const { data: landlords = [] } = useQuery({
    queryKey: ["manager-landlords", user?.id],
    enabled: !!user && mode === "manager",
    queryFn: async () => {
      console.log("Fetching landlords for manager:", user?.id);
      
      // 1. Get IDs of landlords who accepted invites from this manager
      const { data: invites, error: invError } = await supabase
        .from("landlord_invites")
        .select("accepted_user_id, email")
        .eq("manager_user_id", user!.id)
        .eq("status", "aceito");

      if (invError) {
        console.error("Error fetching invites:", invError);
        throw invError;
      }

      console.log("Found invites:", invites);

      const acceptedIds = (invites ?? [])
        .map((i) => i.accepted_user_id)
        .filter(Boolean) as string[];
      
      const acceptedEmails = (invites ?? [])
        .map((i) => i.email)
        .filter(Boolean) as string[];

      // 2. Fetch profiles based on either accepted_user_id OR matching email (for autonomy)
      const query = supabase
        .from("profiles")
        .select("id, full_name, email, document")
        .order("full_name", { ascending: true });

      // We use a complex filter: (id in acceptedIds) OR (email in acceptedEmails)
      // Since supabase-js doesn't have a clean OR for different columns with IN easily in one line, 
      // we can use a raw filter or just fetch both and merge.
      
      let filterStr = "";
      if (acceptedIds.length > 0) {
        filterStr += `id.in.(${acceptedIds.join(",")})`;
      }
      if (acceptedEmails.length > 0) {
        if (filterStr) filterStr += ",";
        filterStr += `email.in.(${acceptedEmails.map(e => `"${e}"`).join(",")})`;
      }

      if (!filterStr) return [];

      const { data: profiles, error: profError } = await query.or(filterStr);

      if (profError) {
        console.error("Error fetching profiles:", profError);
        throw profError;
      }

      console.log("Found profiles:", profiles);

      return (profiles ?? []).map(p => ({
        id: p.id,
        accepted_user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        document: p.document
      }));
    },
  });

  // Corretores (membros ativos da equipe)
  const { data: brokers = [] } = useQuery({
    queryKey: ["manager-brokers", user?.id],
    enabled: !!user && mode === "manager",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_members")
        .select("id, name, email, role_label, is_active, status")
        .eq("manager_user_id", user!.id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const e: any = editing ?? {};
  const [form, setForm] = useState({
    nickname: e.nickname ?? "",
    address: e.address ?? "",
    city: e.city ?? "",
    state: e.state ?? "",
    zip_code: e.zip_code ?? "",
    type: e.type ?? "apartamento",
    rent_price: editing ? String(editing.rent_price) : "0",
    condo_fee: editing ? String(editing.condo_fee) : "0",
    iptu: editing ? String(editing.iptu) : "0",
    status: e.status ?? "disponivel",
    notes: e.notes ?? "",
    tipo_transacao: (e.tipo_transacao as "Aluguel" | "Venda") ?? "Aluguel",
    valor_aluguel: e.valor_aluguel != null ? String(e.valor_aluguel) : "",
    valor_venda: e.valor_venda != null ? String(e.valor_venda) : "",
    publish_imovelweb: Boolean(e.publish_imovelweb),
    publish_zap: Boolean(e.publish_zap),
    bedrooms: String(e.bedrooms ?? 0),
    bathrooms: String(e.bathrooms ?? 0),
    garages: String(e.garages ?? 0),
    area_total: e.area_total != null ? String(e.area_total) : "",
    landlord_id: (e.landlord_id as string | null) ?? "",
    responsible_member_id: (e.responsible_member_id as string | null) ?? "",
    default_management_fee_percent: e.default_management_fee_percent != null ? String(e.default_management_fee_percent) : "10",
  });

  const indisponivel = form.status === "alugado" || form.status === "manutencao";

  function handleStatusChange(v: string) {
    const next = v as Property["status"];
    setForm((f) => ({
      ...f,
      status: next,
      ...(next !== "disponivel" ? { publish_imovelweb: false, publish_zap: false } : {}),
    }));
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
      </DialogHeader>
      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!user) return;
          const isSale = form.tipo_transacao === "Venda";
          const payload: any = {
            user_id: user.id,
            nickname: form.nickname,
            address: form.address,
            city: form.city || null,
            state: form.state || null,
            zip_code: form.zip_code || null,
            type: form.type as Property["type"],
            rent_price: parseNumber(form.rent_price),
            condo_fee: parseNumber(form.condo_fee),
            iptu: parseNumber(form.iptu),
            status: form.status as Property["status"],
            notes: form.notes || null,
            tipo_transacao: form.tipo_transacao,
            valor_aluguel: isSale ? null : (form.valor_aluguel ? parseNumber(form.valor_aluguel) : null),
            valor_venda: isSale ? (form.valor_venda ? parseNumber(form.valor_venda) : null) : null,
            publish_imovelweb: indisponivel || !imwConnected ? false : form.publish_imovelweb,
            publish_zap: indisponivel || !zapConnected ? false : form.publish_zap,
            bedrooms: Number(form.bedrooms) || 0,
            bathrooms: Number(form.bathrooms) || 0,
            garages: Number(form.garages) || 0,
            area_total: form.area_total ? parseNumber(form.area_total) : null,
          };
          if (mode === "manager") {
            payload.manager_id = user.id;
            const selectedLandlord = landlords.find((l) => l.id === form.landlord_id);
            payload.landlord_id = form.landlord_id || null;
            payload.owner_name = selectedLandlord?.full_name || selectedLandlord?.email || null;
            payload.responsible_member_id = form.responsible_member_id || null;
            const feePct = Number(form.default_management_fee_percent);
            payload.default_management_fee_percent =
              Number.isFinite(feePct) && feePct >= 0 && feePct <= 100 ? feePct : 10;
          }
          const { error } = editing
            ? await supabase.from("properties").update(payload).eq("id", editing.id)
            : await supabase.from("properties").insert(payload);
          if (error) return toast.error(error.message);
          toast.success(editing ? "Imóvel atualizado" : "Imóvel cadastrado");
          invalidate(invalidateKeys ?? ["properties"]);
          onDone();
        }}
      >
        <div className="sm:col-span-2 space-y-2">
          <Label>Apelido / Identificação *</Label>
          <Input required value={form.nickname} onChange={(ev) => setForm({ ...form, nickname: ev.target.value })} placeholder="Ex: Apto 302 - Centro" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Endereço completo *</Label>
          <Input required value={form.address} onChange={(ev) => setForm({ ...form, address: ev.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(ev) => setForm({ ...form, city: ev.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2"><Label>Estado</Label><Input value={form.state} onChange={(ev) => setForm({ ...form, state: ev.target.value.toUpperCase().slice(0, 2) })} maxLength={2} placeholder="PR" /></div>
          <div className="space-y-2"><Label>CEP</Label><Input value={form.zip_code} onChange={(ev) => setForm({ ...form, zip_code: maskCEP(ev.target.value) })} placeholder="00000-000" inputMode="numeric" /></div>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Property["type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={handleStatusChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="alugado">Alugado</SelectItem>
              <SelectItem value="manutencao">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipo de Negócio</Label>
          <Select value={form.tipo_transacao} onValueChange={(v) => setForm({ ...form, tipo_transacao: v as "Aluguel" | "Venda" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Aluguel">Aluguel</SelectItem>
              <SelectItem value="Venda">Venda</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.tipo_transacao === "Aluguel" ? (
          <div className="space-y-2">
            <Label>Valor do Aluguel (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_aluguel} onChange={(ev) => setForm({ ...form, valor_aluguel: ev.target.value })} placeholder="0,00" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Valor de Venda (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_venda} onChange={(ev) => setForm({ ...form, valor_venda: ev.target.value })} placeholder="0,00" />
          </div>
        )}

        <div className="space-y-2"><Label>Aluguel base (R$)</Label><Input type="number" step="0.01" value={form.rent_price} onChange={(ev) => setForm({ ...form, rent_price: ev.target.value })} /></div>
        <div className="space-y-2"><Label>Condomínio (R$)</Label><Input type="number" step="0.01" value={form.condo_fee} onChange={(ev) => setForm({ ...form, condo_fee: ev.target.value })} /></div>
        <div className="space-y-2"><Label>IPTU (R$)</Label><Input type="number" step="0.01" value={form.iptu} onChange={(ev) => setForm({ ...form, iptu: ev.target.value })} /></div>
        <div className="space-y-2"><Label>Área total (m²)</Label><Input type="number" step="0.01" value={form.area_total} onChange={(ev) => setForm({ ...form, area_total: ev.target.value })} /></div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <div className="space-y-2"><Label>Quartos</Label><Input type="number" min={0} value={form.bedrooms} onChange={(ev) => setForm({ ...form, bedrooms: ev.target.value })} /></div>
          <div className="space-y-2"><Label>Banheiros</Label><Input type="number" min={0} value={form.bathrooms} onChange={(ev) => setForm({ ...form, bathrooms: ev.target.value })} /></div>
          <div className="space-y-2"><Label>Vagas</Label><Input type="number" min={0} value={form.garages} onChange={(ev) => setForm({ ...form, garages: ev.target.value })} /></div>
        </div>

        {mode === "manager" && (
          <>
            <div className="space-y-2">
              <Label>Proprietário</Label>
              <Select
                value={form.landlord_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, landlord_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um proprietário cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem proprietário vinculado</SelectItem>
                  {landlords.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.full_name || l.email}{l.document ? ` — ${l.document}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {landlords.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum proprietário aceitou convite ainda.{" "}
                  <Link to="/manager/proprietarios" className="underline">
                    Convidar proprietário
                  </Link>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Corretor responsável</Label>
              <Select
                value={form.responsible_member_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, responsible_member_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um corretor da equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem corretor responsável</SelectItem>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.role_label ? `· ${b.role_label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Receberá as notificações de mensagens de manutenção deste imóvel.
              </p>
            </div>
            <div className="sm:col-span-2 space-y-2 rounded-lg border bg-primary/5 border-primary/20 p-3">
              <Label>Repasse da imobiliária (%) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  className="max-w-[140px]"
                  value={form.default_management_fee_percent}
                  onChange={(ev) => setForm({ ...form, default_management_fee_percent: ev.target.value })}
                />
                <span className="text-sm text-muted-foreground">% sobre o valor do aluguel</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Percentual que a imobiliária retém de cada aluguel. O proprietário recebe via PIX o valor restante, já descontada a taxa NEXO e este repasse.
              </p>
            </div>
          </>
        )}

        <div className="sm:col-span-2 space-y-2"><Label>Observações / Descrição</Label><Textarea value={form.notes ?? ""} onChange={(ev) => setForm({ ...form, notes: ev.target.value })} /></div>

        {editing ? (
          <div className="sm:col-span-2">
            <PropertyPhotosUploader propertyId={editing.id} />
          </div>
        ) : (
          <div className="sm:col-span-2 text-xs text-muted-foreground rounded-lg border border-dashed p-3 bg-muted/30">
            💡 Salve o imóvel primeiro para começar a enviar fotos.
          </div>
        )}

        <div className="sm:col-span-2 space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h4 className="font-semibold text-sm">Sincronização com Portais</h4>
            <p className="text-xs text-muted-foreground">Controle a distribuição automática deste imóvel para os portais imobiliários.</p>
          </div>

          {indisponivel && (
            <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Imóvel indisponível. Os anúncios correspondentes serão limpos e removidos dos portais na próxima sincronização automática.
              </AlertDescription>
            </Alert>
          )}

          {(!imwConnected || !zapConnected) && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300 flex flex-wrap items-center gap-2">
                <span>Conecte os portais antes de habilitar a sincronização.</span>
                <Link to={mode === "manager" ? "/manager/portais" : "/admin/integracoes"} className="underline font-medium hover:text-amber-800 dark:hover:text-amber-200">
                  Ir para Integrações
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Imovelweb {!imwConnected && <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">(integração pendente)</span>}</p>
              <p className="text-xs text-muted-foreground">Publicar este imóvel no feed Imovelweb.</p>
            </div>
            <Switch
              checked={form.publish_imovelweb}
              disabled={indisponivel || !imwConnected}
              onCheckedChange={(v) => {
                if (!imwConnected) {
                  toast.error("Conecte o Imovelweb em Integrações antes de ativar a sincronização.");
                  return;
                }
                setForm({ ...form, publish_imovelweb: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Grupo OLX (Zap / VivaReal) {!zapConnected && <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">(integração pendente)</span>}</p>
              <p className="text-xs text-muted-foreground">Distribuir automaticamente nos portais Zap e VivaReal.</p>
            </div>
            <Switch
              checked={form.publish_zap}
              disabled={indisponivel || !zapConnected}
              onCheckedChange={(v) => {
                if (!zapConnected) {
                  toast.error("Conecte o Grupo OLX em Integrações antes de ativar a sincronização.");
                  return;
                }
                setForm({ ...form, publish_zap: v });
              }}
            />
          </div>
        </div>

        <DialogFooter className="sm:col-span-2">
          <Button type="submit">{editing ? "Salvar alterações" : "Cadastrar imóvel"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
