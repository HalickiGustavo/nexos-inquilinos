import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Bed,
  Bath,
  Car,
  Ruler,
  Wallet,
  Wrench,
  User2,
  CalendarClock,
  FileText,
  FolderOpen,
  ClipboardCheck,
  Phone,
  Mail,
  ExternalLink,
  Pencil,
  History,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  useContracts,
  useInstallments,
  useMaintenances,
  useTenants,
  type Property,
} from "@/lib/queries";
import { useDocuments, CATEGORY_LABEL } from "@/lib/documents";
import { useInspections } from "@/lib/inspections";
import { formatBRL, formatDate } from "@/lib/format";

function usePropertyPhotos(propertyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["property-photos", propertyId],
    enabled: !!propertyId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("id, url, position")
        .eq("property_id", propertyId!)
        .order("position", { ascending: true });
      if (error) throw error;
      const bucket = "property-images";
      const marker = `/${bucket}/`;
      return Promise.all(
        (data ?? []).map(async (r) => {
          const idx = r.url.indexOf(marker);
          if (idx < 0) return { ...r, displayUrl: r.url };
          const path = r.url.slice(idx + marker.length).split("?")[0];
          const { data: sig } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          return { ...r, displayUrl: sig?.signedUrl ?? r.url };
        }),
      );
    },
  });
}

export function PropertyDetailsDialog({
  property,
  open,
  onOpenChange,
  onEdit,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit?: (p: Property) => void;
}) {
  const { data: contracts = [] } = useContracts();
  const { data: installments = [] } = useInstallments();
  const { data: maintenances = [] } = useMaintenances();
  const { data: tenants = [] } = useTenants();
  const { data: documents = [] } = useDocuments();
  const { data: inspections = [] } = useInspections();
  const photosQ = usePropertyPhotos(property?.id, open);

  const d = useMemo(() => {
    if (!property) return null;
    const id = property.id;
    const propContracts = (contracts as any[]).filter(
      (c) => c.property_id === id && !c.deleted_at,
    );
    const activeContract = propContracts.find((c) => c.active) ?? null;
    const activeTenant = activeContract
      ? tenants.find((t) => t.id === activeContract.tenant_id)
      : null;
    const propInstallments = (installments as any[]).filter(
      (i) => i.contract?.property_id === id,
    );
    const propMaint = (maintenances as any[]).filter((m) => m.property_id === id);
    const propDocs = (documents as any[]).filter((doc) => doc.property_id === id);
    const propInsp = (inspections as any[]).filter(
      (insp) => insp.contract?.property_id === id,
    );

    const yearStart = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    let totalRevenue = 0;
    let ytdRevenue = 0;
    let pending = 0;
    let overdue = 0;
    for (const i of propInstallments) {
      const paid = Number(i.paid_amount || 0);
      if (i.status === "pago") {
        totalRevenue += paid;
        if (i.payment_date && i.payment_date >= yearStart) ytdRevenue += paid;
      } else {
        pending += Number(i.amount || 0);
        if (i.due_date < today) overdue += Number(i.amount || 0);
      }
    }

    const openMaint = propMaint.filter((m) => m.status !== "concluido");
    const doneMaint = propMaint.filter((m) => m.status === "concluido");
    const maintSpend = propMaint.reduce(
      (s, m) => s + Number(m.payment_paid_amount || m.cost || 0),
      0,
    );

    return {
      activeContract,
      activeTenant,
      propContracts,
      propInstallments,
      propMaint,
      propDocs,
      propInsp,
      totalRevenue,
      ytdRevenue,
      pending,
      overdue,
      openMaint,
      doneMaint,
      maintSpend,
    };
  }, [property, contracts, installments, maintenances, documents, inspections, tenants]);

  if (!property || !d) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Imóvel</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const heroPhoto = photosQ.data?.[0]?.displayUrl;
  const status = d.activeContract
    ? "alugado"
    : property.status === "manutencao"
      ? "manutencao"
      : "disponivel";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{property.nickname}</DialogTitle>
          <DialogDescription>{property.address}</DialogDescription>
        </DialogHeader>

        {/* Hero */}
        <div className="grid md:grid-cols-[280px_1fr] gap-0 border-b">
          <div className="aspect-video md:aspect-auto md:h-full bg-muted flex items-center justify-center overflow-hidden">
            {heroPhoto ? (
              <img
                src={heroPhoto}
                alt={property.nickname}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Building2 className="size-16 text-muted-foreground/50" />
            )}
          </div>
          <div className="p-5 flex flex-col gap-3 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight truncate">
                  {property.nickname}
                </h2>
                <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{property.address}</span>
                </p>
                {property.code ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Código: {property.code}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {status === "alugado" ? (
                  <Badge className="bg-primary text-primary-foreground">Alugado</Badge>
                ) : status === "manutencao" ? (
                  <Badge variant="secondary">Manutenção</Badge>
                ) : (
                  <Badge variant="secondary">Disponível</Badge>
                )}
                <Badge variant="outline" className="capitalize">
                  {property.type}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat
                icon={Wallet}
                label="Aluguel"
                value={formatBRL(Number(property.rent_price))}
                tone="primary"
              />
              <MiniStat
                icon={Wallet}
                label="Receita YTD"
                value={formatBRL(d.ytdRevenue)}
                tone="emerald"
              />
              <MiniStat
                icon={Wallet}
                label="Total"
                value={formatBRL(d.totalRevenue)}
              />
              <MiniStat
                icon={Wrench}
                label="Manut."
                value={String(d.openMaint.length)}
                tone={d.openMaint.length > 0 ? "amber" : "muted"}
              />
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <span className="inline-flex items-center gap-1">
                <Bed className="size-3" /> {property.bedrooms} quartos
              </span>
              <span className="inline-flex items-center gap-1">
                <Bath className="size-3" /> {property.bathrooms} banheiros
              </span>
              <span className="inline-flex items-center gap-1">
                <Car className="size-3" /> {property.garages} vagas
              </span>
              {property.area_total ? (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-3" /> {property.area_total} m²
                </span>
              ) : null}
            </div>

            <div className="flex gap-2 flex-wrap pt-1">
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/properties/$id"
                  params={{ id: property.id }}
                  onClick={() => onOpenChange(false)}
                >
                  <ExternalLink className="size-3.5 mr-1.5" /> Página completa
                </Link>
              </Button>
              {onEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(property);
                  }}
                >
                  <Pencil className="size-3.5 mr-1.5" /> Editar
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-5">
          <Tabs defaultValue="resumo">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="contrato">Contrato</TabsTrigger>
              <TabsTrigger value="inquilino">Inquilino</TabsTrigger>
              <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="vistorias">Vistorias</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="mt-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-1">
                  <h3 className="font-semibold text-sm mb-2">Dados do imóvel</h3>
                  <InfoRow label="Endereço" value={property.address} />
                  <InfoRow label="Bairro" value={property.neighborhood} />
                  <InfoRow
                    label="Cidade / UF"
                    value={
                      [property.city, property.state].filter(Boolean).join(" / ") || "—"
                    }
                  />
                  <InfoRow label="CEP" value={property.zip_code} />
                  <InfoRow label="Tipo" value={property.type} capitalize />
                  <InfoRow
                    label="Transação"
                    value={property.tipo_transacao}
                    capitalize
                  />
                </Card>
                <Card className="p-4 space-y-1">
                  <h3 className="font-semibold text-sm mb-2">Valores</h3>
                  <InfoRow
                    label="Aluguel"
                    value={formatBRL(Number(property.rent_price))}
                  />
                  <InfoRow
                    label="Condomínio"
                    value={formatBRL(Number(property.condo_fee))}
                  />
                  <InfoRow label="IPTU" value={formatBRL(Number(property.iptu))} />
                  <InfoRow
                    label="Taxa administração"
                    value={`${property.default_management_fee_percent}%`}
                  />
                  <InfoRow
                    label="Comissão proprietário"
                    value={`${property.owner_commission_percent}%`}
                  />
                  {property.valor_venda ? (
                    <InfoRow
                      label="Valor de venda"
                      value={formatBRL(Number(property.valor_venda))}
                    />
                  ) : null}
                </Card>
              </div>
              {property.description ? (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-2">Descrição</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {property.description}
                  </p>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="financeiro" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Receita total" value={formatBRL(d.totalRevenue)} />
                <StatCard
                  label="Receita YTD"
                  value={formatBRL(d.ytdRevenue)}
                  tone="emerald"
                />
                <StatCard
                  label="A receber"
                  value={formatBRL(d.pending)}
                  tone="amber"
                />
                <StatCard
                  label="Em atraso"
                  value={formatBRL(d.overdue)}
                  tone="destructive"
                />
              </div>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Últimas parcelas</h3>
                  <Button variant="link" size="sm" asChild>
                    <Link
                      to="/financials"
                      onClick={() => onOpenChange(false)}
                    >
                      Ver todas
                    </Link>
                  </Button>
                </div>
                <div className="space-y-1.5 text-sm">
                  {d.propInstallments.slice(0, 8).map((i: any) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate">
                          Vencimento {formatDate(i.due_date)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {i.status === "pago" && i.payment_date
                            ? `Pago em ${formatDate(i.payment_date)}`
                            : i.status}
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="font-semibold">
                          {formatBRL(Number(i.amount))}
                        </div>
                        {i.paid_amount ? (
                          <div className="text-xs text-emerald-500">
                            {formatBRL(Number(i.paid_amount))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {d.propInstallments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma parcela.</p>
                  ) : null}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="contrato" className="mt-4 space-y-3">
              {d.activeContract ? (
                <Card className="p-4 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Contrato ativo</h3>
                    <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
                  </div>
                  <InfoRow
                    label="Início"
                    value={formatDate(d.activeContract.start_date)}
                  />
                  <InfoRow label="Fim" value={formatDate(d.activeContract.end_date)} />
                  <InfoRow
                    label="Dias restantes"
                    value={String(
                      Math.max(
                        0,
                        Math.ceil(
                          (new Date(d.activeContract.end_date).getTime() -
                            new Date().getTime()) /
                            86400000,
                        ),
                      ),
                    )}
                  />
                  <InfoRow
                    label="Aluguel"
                    value={formatBRL(Number(d.activeContract.rent_amount))}
                  />
                  <InfoRow
                    label="Dia de vencimento"
                    value={String(d.activeContract.due_day)}
                  />
                  <InfoRow
                    label="Índice reajuste"
                    value={d.activeContract.readjustment_index}
                  />
                  <InfoRow
                    label="Multa atraso"
                    value={`${d.activeContract.late_fee_percent}%`}
                  />
                  <InfoRow
                    label="Juros diários"
                    value={`${d.activeContract.daily_interest_percent}%`}
                  />
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <CalendarClock className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">
                    Nenhum contrato ativo.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/contracts" onClick={() => onOpenChange(false)}>
                      Criar contrato
                    </Link>
                  </Button>
                </Card>
              )}
              {d.propContracts.filter((c: any) => !c.active).length > 0 ? (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-2">Contratos anteriores</h3>
                  <div className="space-y-1.5 text-sm">
                    {d.propContracts
                      .filter((c: any) => !c.active)
                      .map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
                        >
                          <div className="truncate">
                            {formatDate(c.start_date)} → {formatDate(c.end_date)}
                          </div>
                          <div className="text-muted-foreground tabular-nums shrink-0">
                            {formatBRL(Number(c.rent_amount))}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="inquilino" className="mt-4">
              {d.activeTenant ? (
                <Card className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User2 className="size-4 text-primary" />
                    <h3 className="font-semibold text-sm">{d.activeTenant.full_name}</h3>
                  </div>
                  <InfoRow
                    label="CPF/CNPJ"
                    value={(d.activeTenant as any).document ?? "—"}
                  />
                  <InfoRow label="E-mail" value={d.activeTenant.email} icon={Mail} />
                  <InfoRow label="Telefone" value={d.activeTenant.phone} icon={Phone} />
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <User2 className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Sem inquilino ativo.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="manutencoes" className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Abertas"
                  value={String(d.openMaint.length)}
                  tone="amber"
                />
                <StatCard
                  label="Concluídas"
                  value={String(d.doneMaint.length)}
                  tone="emerald"
                />
                <StatCard label="Gasto" value={formatBRL(d.maintSpend)} />
              </div>
              {d.propMaint.length === 0 ? (
                <Card className="p-6 text-center">
                  <Wrench className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Sem manutenções.</p>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="space-y-1.5 text-sm">
                    {d.propMaint.slice(0, 15).map((m: any) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(m.created_at)} · {m.status}
                          </div>
                        </div>
                        <div className="tabular-nums shrink-0">
                          {formatBRL(
                            Number(
                              m.payment_paid_amount ||
                                m.cost ||
                                m.budget_amount ||
                                0,
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="documentos" className="mt-4">
              {d.propDocs.length === 0 ? (
                <Card className="p-6 text-center">
                  <FolderOpen className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhum documento.</p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/documentos" onClick={() => onOpenChange(false)}>
                      Adicionar documento
                    </Link>
                  </Button>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="space-y-1.5 text-sm">
                    {d.propDocs.slice(0, 20).map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="truncate">{doc.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {CATEGORY_LABEL[doc.category] ?? doc.category} ·{" "}
                              {formatDate(doc.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="vistorias" className="mt-4">
              {d.propInsp.length === 0 ? (
                <Card className="p-6 text-center">
                  <ClipboardCheck className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma vistoria.</p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/vistorias" onClick={() => onOpenChange(false)}>
                      Registrar vistoria
                    </Link>
                  </Button>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="space-y-1.5 text-sm">
                    {d.propInsp.map((insp: any) => (
                      <div
                        key={insp.id}
                        className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
                      >
                        <div>
                          <div className="capitalize">{insp.kind}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(insp.inspection_date)} ·{" "}
                            {insp.general_condition}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {insp.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="size-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Linha do tempo</h3>
                </div>
                <TimelineList items={buildTimeline(d)} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  capitalize,
}: {
  label: string;
  value: any;
  icon?: any;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0 text-xs">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </span>
      <span className={`text-right truncate ${capitalize ? "capitalize" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = "muted",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "muted" | "primary" | "emerald" | "amber" | "destructive";
}) {
  const toneClass = {
    muted: "text-foreground",
    primary: "text-primary",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide truncate">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`font-bold text-sm tabular-nums truncate ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "emerald" | "amber" | "destructive";
}) {
  const toneClass = {
    muted: "text-foreground",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    destructive: "text-destructive",
  }[tone];
  return (
    <Card className="p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${toneClass}`}>{value}</div>
    </Card>
  );
}

type TimelineItem = { date: string; kind: string; title: string; sub?: string };

function buildTimeline(d: any): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const c of d.propContracts as any[]) {
    items.push({
      date: c.start_date,
      kind: "Contrato",
      title: "Contrato iniciado",
      sub: `${formatBRL(Number(c.rent_amount))} · até ${formatDate(c.end_date)}`,
    });
  }
  for (const i of d.propInstallments as any[]) {
    if (i.status === "pago" && i.payment_date) {
      items.push({
        date: i.payment_date,
        kind: "Pagamento",
        title: `Recebido ${formatBRL(Number(i.paid_amount || i.amount))}`,
        sub: `Vencimento ${formatDate(i.due_date)}`,
      });
    }
  }
  for (const m of d.propMaint as any[]) {
    items.push({
      date: m.created_at,
      kind: "Manutenção",
      title: m.title,
      sub: m.status,
    });
  }
  for (const insp of d.propInsp as any[]) {
    items.push({
      date: insp.inspection_date,
      kind: "Vistoria",
      title: `Vistoria ${insp.kind}`,
      sub: insp.general_condition,
    });
  }
  for (const doc of d.propDocs as any[]) {
    items.push({
      date: doc.created_at,
      kind: "Documento",
      title: doc.name,
      sub: CATEGORY_LABEL[doc.category] ?? doc.category,
    });
  }
  return items
    .filter((x) => !!x.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 40);
}

function TimelineList({ items }: { items: TimelineItem[] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex gap-3 text-sm">
          <div className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums pt-0.5">
            {formatDate(it.date)}
          </div>
          <div className="min-w-0 flex-1 border-l border-border/50 pl-3">
            <div className="text-[10px] uppercase tracking-wide text-primary">
              {it.kind}
            </div>
            <div className="font-medium truncate">{it.title}</div>
            {it.sub ? (
              <div className="text-xs text-muted-foreground truncate">{it.sub}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
