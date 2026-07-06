import { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PropertyDetailsDialog } from "@/components/owner/PropertyDetailsDialog";
import {
  Building2,
  Pencil,
  Trash2,
  User2,
  CalendarClock,
  MoreVertical,
  ArrowUpRight,
  Wrench,
  ClipboardCheck,
  FolderOpen,
  FileText,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ui/confirm";
import { formatBRL, formatDate } from "@/lib/format";
import { useInvalidate, type Property } from "@/lib/queries";

export type PropertyCardData = {
  property: Property;
  status: "alugado" | "disponivel" | "manutencao";
  tenantName?: string;
  contractEnd?: string | null;
  lastPaymentDate?: string | null;
  nextDueDate?: string | null;
  ytdRevenue: number;
  totalRevenue: number;
  paymentHealth: "green" | "yellow" | "red" | "neutral";
  openMaintenances: number;
  lastInspectionDate?: string | null;
  lastDocumentDate?: string | null;
};

function healthDot(h: PropertyCardData["paymentHealth"]) {
  const map = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-destructive",
    neutral: "bg-muted-foreground/50",
  };
  return <span className={`inline-block size-2 rounded-full ${map[h]}`} aria-hidden />;
}

function statusBadge(s: PropertyCardData["status"]) {
  if (s === "alugado")
    return <Badge className="bg-primary text-primary-foreground">Alugado</Badge>;
  if (s === "manutencao") return <Badge variant="secondary">Manutenção</Badge>;
  return <Badge variant="secondary">Disponível</Badge>;
}

function PropertyCardImpl({
  data,
  onEdit,
}: {
  data: PropertyCardData;
  onEdit: (p: Property) => void;
}) {
  const p = data.property;
  const invalidate = useInvalidate();
  const confirm = useConfirm();
  const [detailOpen, setDetailOpen] = useState(false);

  const paymentLabel = useMemo(() => {
    switch (data.paymentHealth) {
      case "green":
        return "Em dia";
      case "yellow":
        return "Atenção";
      case "red":
        return "Em atraso";
      default:
        return "Sem contrato";
    }
  }, [data.paymentHealth]);

  const onDelete = async () => {
    const ok = await confirm({
      title: "Excluir este imóvel?",
      description:
        "O imóvel será removido permanentemente. Contratos vinculados podem bloquear a exclusão.",
      confirmLabel: "Excluir imóvel",
      tone: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("properties").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Imóvel excluído");
    invalidate(["properties"]);
  };

  const openDetail = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a,button,[role='menu'],[role='menuitem']")) return;
    setDetailOpen(true);
  };

  return (
    <Card
      onClick={openDetail}
      className="p-5 flex flex-col gap-4 hover:shadow-md transition group h-full cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <Link
          to="/properties/$id"
          params={{ id: p.id }}
          className="min-w-0 flex-1 group/link"
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold truncate group-hover/link:text-primary transition">
              {p.nickname}
            </h3>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground group-hover/link:text-primary transition" />
          </div>
          <p className="text-sm text-muted-foreground truncate">{p.address}</p>
          {p.code ? (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Código: {p.code}</p>
          ) : null}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {statusBadge(data.status)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Ações do imóvel"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/properties/$id" params={{ id: p.id }}>
                  <Building2 className="size-4 mr-2" /> Ver imóvel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/contracts">
                  <FileText className="size-4 mr-2" /> Contratos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/conta-corrente">
                  <Wallet className="size-4 mr-2" /> Conta Corrente
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/documentos">
                  <FolderOpen className="size-4 mr-2" /> Documentos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vistorias">
                  <ClipboardCheck className="size-4 mr-2" /> Vistorias
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/maintenances">
                  <Wrench className="size-4 mr-2" /> Manutenções
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(p)}>
                <Pencil className="size-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Financeiro básico */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-muted/30 border border-border/60 px-2 py-1.5 min-w-0">
          <div className="text-[10px] uppercase text-muted-foreground truncate">Aluguel</div>
          <div className="font-semibold text-primary tabular-nums truncate">
            {formatBRL(Number(p.rent_price))}
          </div>
        </div>
        <div className="rounded-md bg-muted/30 border border-border/60 px-2 py-1.5 min-w-0">
          <div className="text-[10px] uppercase text-muted-foreground truncate">Condomínio</div>
          <div className="font-semibold tabular-nums truncate">
            {formatBRL(Number(p.condo_fee))}
          </div>
        </div>
        <div className="rounded-md bg-muted/30 border border-border/60 px-2 py-1.5 min-w-0">
          <div className="text-[10px] uppercase text-muted-foreground truncate">IPTU</div>
          <div className="font-semibold tabular-nums truncate">
            {formatBRL(Number(p.iptu))}
          </div>
        </div>
      </div>

      {/* Inquilino + contrato */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <User2 className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">Inquilino:</span>
          <span className="truncate">{data.tenantName ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">Contrato até:</span>
          <span className="truncate">{formatDate(data.contractEnd)}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {healthDot(data.paymentHealth)}
          <span className="text-muted-foreground shrink-0">Pagamento:</span>
          <span className="truncate">{paymentLabel}</span>
          {data.nextDueDate ? (
            <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">
              venc. {formatDate(data.nextDueDate)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Receita agregada */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-border/60 px-2 py-1.5">
          <div className="text-[10px] uppercase text-muted-foreground">Receita YTD</div>
          <div className="font-semibold tabular-nums text-emerald-500">
            {formatBRL(data.ytdRevenue)}
          </div>
        </div>
        <div className="rounded-md border border-border/60 px-2 py-1.5">
          <div className="text-[10px] uppercase text-muted-foreground">Receita total</div>
          <div className="font-semibold tabular-nums">{formatBRL(data.totalRevenue)}</div>
        </div>
      </div>

      {/* Micro-indicadores */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <Wrench className="size-3" />
          {data.openMaintenances > 0
            ? `${data.openMaintenances} aberta(s)`
            : "sem manutenção"}
        </span>
        {data.lastInspectionDate ? (
          <span className="inline-flex items-center gap-1">
            <ClipboardCheck className="size-3" /> vistoria {formatDate(data.lastInspectionDate)}
          </span>
        ) : null}
        {data.lastDocumentDate ? (
          <span className="inline-flex items-center gap-1">
            <FolderOpen className="size-3" /> doc {formatDate(data.lastDocumentDate)}
          </span>
        ) : null}
        {data.lastPaymentDate ? (
          <span className="inline-flex items-center gap-1 ml-auto">
            <Wallet className="size-3" /> últ. pgto {formatDate(data.lastPaymentDate)}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export const PropertyCard = memo(PropertyCardImpl);
