import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowLeft, MapPin, Building2, User, FileText, Receipt, ClipboardList, Wrench, History,
  Calendar, TrendingUp, Percent, CheckCircle2, AlertCircle, Home,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useLandlordProperties, useLandlordContracts, useLandlordInstallments,
  useLandlordMaintenances, usePropertyAggregates,
} from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

type Tab = "resumo" | "financeiro" | "contrato" | "documentos" | "vistorias" | "manutencoes" | "historico";
const TABS: Tab[] = ["resumo", "financeiro", "contrato", "documentos", "vistorias", "manutencoes", "historico"];

export const Route = createFileRoute("/_landlord/landlord/imoveis/$id")({
  head: () => ({ meta: [{ title: "Imóvel — Proprietário NEXO" }] }),
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => ({
    tab: (TABS as string[]).includes(s.tab as string) ? (s.tab as Tab) : "resumo",
  }),
  component: LandlordImovelDetail,
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="text-sm text-rose-300">{error.message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => reset()}>Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center text-sm">Imóvel não encontrado.</div>,
});

function LandlordImovelDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: properties = [] } = useLandlordProperties();
  const { data: contracts = [] } = useLandlordContracts();
  const { data: installments = [] } = useLandlordInstallments();
  const { data: maintenances = [] } = useLandlordMaintenances();
  const aggregates = usePropertyAggregates();

  const property = useMemo(() => (properties as any[]).find((p) => p.id === id), [properties, id]);
  const activeContract = useMemo(
    () => (contracts as any[]).find((c) => c.property_id === id && c.active),
    [contracts, id],
  );
  const allContracts = useMemo(
    () => (contracts as any[]).filter((c) => c.property_id === id),
    [contracts, id],
  );
  const propInstallments = useMemo(
    () => (installments as any[]).filter((i) => i.contract?.property?.id === id),
    [installments, id],
  );
  const propMaintenances = useMemo(
    () => (maintenances as any[]).filter((m) => m.property?.id === id),
    [maintenances, id],
  );
  const agg = aggregates.get(id);

  if (!property) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Carregando imóvel…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 mb-2 text-muted-foreground">
          <Link to="/landlord/imoveis"><ArrowLeft className="size-4 mr-1" />Todos os imóveis</Link>
        </Button>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
              {property.nickname || property.address}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />{property.address}
              {property.city && <> · {property.city}/{property.state}</>}
            </p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusColor(property.status)}`}>{statusLabel(property.status)}</Badge>
        </div>
      </div>

      {/* Resumo compacto sempre visível */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryTile label="Código" value={property.code || "—"} />
        <SummaryTile label="Aluguel" value={formatBRL(Number(property.rent_price))} tone="primary" />
        <SummaryTile label="Receita no ano" value={formatBRL(agg?.receitaAno ?? 0)} tone="violet" />
        <SummaryTile label="Receita total" value={formatBRL(agg?.receitaTotal ?? 0)} tone="emerald" />
        <SummaryTile label="Inadimplência" value={formatBRL(agg?.inadimplencia ?? 0)} tone={(agg?.inadimplencia ?? 0) > 0 ? "rose" : "zinc"} />
        <SummaryTile label="Rentabilidade" value={rentabilidade(property, agg)} tone="emerald" />
      </div>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as any }, replace: true })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumo"><Home className="size-3.5 mr-1.5" />Resumo</TabsTrigger>
          <TabsTrigger value="financeiro"><Receipt className="size-3.5 mr-1.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="contrato"><FileText className="size-3.5 mr-1.5" />Contrato</TabsTrigger>
          <TabsTrigger value="documentos"><ClipboardList className="size-3.5 mr-1.5" />Documentos</TabsTrigger>
          <TabsTrigger value="vistorias"><ClipboardList className="size-3.5 mr-1.5" />Vistorias</TabsTrigger>
          <TabsTrigger value="manutencoes"><Wrench className="size-3.5 mr-1.5" />Manutenções</TabsTrigger>
          <TabsTrigger value="historico"><History className="size-3.5 mr-1.5" />Histórico</TabsTrigger>
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <h2 className="font-semibold inline-flex items-center gap-2 mb-3">
                <Building2 className="size-4 text-primary" /> Ficha do imóvel
              </h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Field label="Tipo" value={property.type || "—"} />
                <Field label="Quartos" value={property.bedrooms ?? "—"} />
                <Field label="Banheiros" value={property.bathrooms ?? "—"} />
                <Field label="Vagas" value={property.garages ?? "—"} />
                <Field label="Área total" value={property.area_total ? `${property.area_total} m²` : "—"} />
                <Field label="Bairro" value={property.neighborhood || "—"} />
                <Field label="Condomínio" value={property.condo_fee ? formatBRL(Number(property.condo_fee)) : "—"} />
                <Field label="IPTU" value={property.iptu ? formatBRL(Number(property.iptu)) : "—"} />
                <Field label="Comissão" value={`${property.owner_commission_percent ?? 0}%`} />
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold inline-flex items-center gap-2 mb-3">
                <User className="size-4 text-primary" /> Inquilino atual
              </h2>
              {activeContract ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{activeContract.tenant?.full_name || "—"}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Contrato: {formatDate(activeContract.start_date)} → {formatDate(activeContract.end_date)}</p>
                    <p>Reajuste: {activeContract.readjustment_index}</p>
                    <p>Valor: {formatBRL(Number(activeContract.rent_amount))} · Vence dia {activeContract.due_day}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem contrato ativo no momento.</p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* FINANCEIRO */}
        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile label="Receita prevista mês" value={formatBRL(sumMonth(propInstallments, "prevista"))} tone="violet" />
            <SummaryTile label="Receita realizada mês" value={formatBRL(sumMonth(propInstallments, "recebida"))} tone="emerald" />
            <SummaryTile label="Receita líquida (est.)" value={formatBRL((agg?.receitaTotal ?? 0) * (1 - (Number(property.owner_commission_percent) || 0) / 100))} tone="emerald" />
            <SummaryTile label="Retido em manutenção" value={formatBRL(propMaintenances.filter((m: any) => m.status !== "concluida").reduce((s: number, m: any) => s + Number(m.budget_amount || 0), 0))} tone="amber" />
          </div>

          <Card className="p-5">
            <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Parcelas do imóvel
            </h2>
            {propInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma parcela registrada.</p>
            ) : (
              <ul className="divide-y divide-border">
                {propInstallments.slice(0, 24).map((i: any) => (
                  <li key={i.id} className="py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <Calendar className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Vencimento {formatDate(i.due_date)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {i.status === "pago" ? `Pago em ${formatDate(i.paid_at || i.payment_date)}` : i.status}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{formatBRL(Number(i.paid_amount || i.amount))}</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${installmentBadge(i)}`}>{installmentLabel(i)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* CONTRATO */}
        <TabsContent value="contrato" className="mt-4 space-y-4">
          {activeContract ? (
            <Card className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <SummaryTile label="Vigência" value={`${formatDate(activeContract.start_date)} → ${formatDate(activeContract.end_date)}`} />
                <SummaryTile label="Dias restantes" value={String(daysUntil(activeContract.end_date))} tone={daysUntil(activeContract.end_date) < 30 ? "amber" : "emerald"} />
                <SummaryTile label="Valor atual" value={formatBRL(Number(activeContract.rent_amount))} tone="primary" />
                <SummaryTile label="Índice reajuste" value={activeContract.readjustment_index || "—"} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Field label="Dia de vencimento" value={activeContract.due_day} />
                <Field label="Multa atraso" value={`${activeContract.late_fee_percent ?? 0}%`} />
                <Field label="Juros diários" value={`${activeContract.daily_interest_percent ?? 0}%`} />
                <Field label="Depósito caução" value={formatBRL(Number(activeContract.security_deposit || 0))} />
                <Field label="Taxa adm." value={`${activeContract.agency_admin_fee_percentage ?? 0}%`} />
                <Field label="Status" value={activeContract.active ? "Ativo" : "Encerrado"} />
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
            </Card>
          )}

          {allContracts.length > 1 && (
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3">Histórico de contratos</h3>
              <ul className="divide-y divide-border text-sm">
                {allContracts.map((c: any) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <span className="truncate">{c.tenant?.full_name || "—"}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.start_date)} → {formatDate(c.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        {/* DOCUMENTOS / VISTORIAS — placeholders informativos */}
        <TabsContent value="documentos" className="mt-4">
          <PlaceholderTab
            icon={<ClipboardList className="size-8" />}
            title="Documentos deste imóvel"
            text="A visão detalhada de documentos por imóvel será liberada em breve. Enquanto isso, sua imobiliária pode compartilhá-los por outros canais."
          />
        </TabsContent>
        <TabsContent value="vistorias" className="mt-4">
          <PlaceholderTab
            icon={<ClipboardList className="size-8" />}
            title="Vistorias deste imóvel"
            text="O histórico completo de vistorias com download em PDF entra na próxima entrega."
          />
        </TabsContent>

        {/* MANUTENÇÕES */}
        <TabsContent value="manutencoes" className="mt-4">
          {propMaintenances.length === 0 ? (
            <PlaceholderTab icon={<Wrench className="size-8" />} title="Sem manutenções" text="Nenhum chamado registrado para este imóvel." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {propMaintenances.map((m: any) => (
                <Card key={m.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{m.title}</p>
                    <Badge variant="outline" className={maintBadge(m.status)}>{m.status}</Badge>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                    <Field label="Aberto em" value={formatDate(m.created_at)} />
                    {m.budget_amount && <Field label="Orçamento" value={formatBRL(Number(m.budget_amount))} />}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-4">
          <Card className="p-5">
            <ul className="space-y-3 text-sm">
              {buildHistory(propInstallments, propMaintenances).map((h, i) => (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center py-1 border-b border-border/60 last:border-0">
                  <span className={`size-2 rounded-full ${h.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate">{h.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.subtitle}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(h.date)}</span>
                </li>
              ))}
              {buildHistory(propInstallments, propMaintenances).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem histórico ainda.</p>
              )}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-medium truncate">{value ?? "—"}</dd>
    </div>
  );
}

function SummaryTile({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "primary" | "emerald" | "violet" | "rose" | "amber" | "zinc" }) {
  const map = {
    primary: "text-primary", emerald: "text-emerald-400", violet: "text-violet-400",
    rose: "text-rose-400", amber: "text-amber-400", zinc: "text-foreground",
  } as const;
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`font-bold tabular-nums truncate ${map[tone]} mt-0.5`}>{value}</p>
    </Card>
  );
}

function PlaceholderTab({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto text-muted-foreground mb-3 w-fit">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{text}</p>
    </Card>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "alugado": return "border-emerald-500/40 text-emerald-300";
    case "disponivel": return "border-zinc-700 text-zinc-300";
    case "manutencao": return "border-amber-500/40 text-amber-300";
    default: return "border-border text-muted-foreground";
  }
}
function statusLabel(status: string) {
  return { alugado: "Alugado", disponivel: "Disponível", manutencao: "Em manutenção" }[status] || status;
}
function installmentBadge(i: any) {
  if (i.status === "pago") return "border-emerald-500/40 text-emerald-300";
  if (i.due_date < new Date().toISOString().slice(0, 10)) return "border-rose-500/40 text-rose-300";
  return "border-violet-500/40 text-violet-300";
}
function installmentLabel(i: any) {
  if (i.status === "pago") return "Pago";
  if (i.due_date < new Date().toISOString().slice(0, 10)) return "Atrasado";
  return "Aberto";
}
function maintBadge(status: string) {
  if (status === "concluida") return "border-emerald-500/40 text-emerald-300";
  if (status === "em_andamento") return "border-violet-500/40 text-violet-300";
  return "border-amber-500/40 text-amber-300";
}
function daysUntil(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86400000));
}
function sumMonth(list: any[], mode: "prevista" | "recebida") {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return list.filter((i) => i.due_date >= start && i.due_date <= end)
    .reduce((s, i) => s + (mode === "recebida" ? (i.status === "pago" ? Number(i.paid_amount || i.amount) : 0) : Number(i.amount)), 0);
}
function rentabilidade(p: any, agg: any) {
  const rent = Number(p.rent_price) || 0;
  const total = agg?.receitaTotal || 0;
  if (!rent) return "—";
  const meses = total / rent;
  return `${meses.toFixed(1)} meses`;
}
function buildHistory(inst: any[], maint: any[]) {
  const items: { date: string; title: string; subtitle: string; dot: string }[] = [];
  for (const i of inst) {
    if (i.status === "pago") items.push({
      date: i.paid_at || i.payment_date || i.due_date,
      title: "Aluguel recebido",
      subtitle: formatBRL(Number(i.paid_amount || i.amount)),
      dot: "bg-emerald-400",
    });
  }
  for (const m of maint) {
    items.push({
      date: m.created_at,
      title: `Manutenção: ${m.title}`,
      subtitle: m.status,
      dot: m.status === "concluida" ? "bg-emerald-400" : "bg-amber-400",
    });
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
}

// avoid TS unused warnings from selectively used icons
void CheckCircle2; void AlertCircle; void Percent;
