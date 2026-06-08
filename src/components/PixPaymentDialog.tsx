import { useState } from "react";
import { Copy, Download, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";

const PIX_FALLBACK = "contato@nexo.com.br";

// QR Code SVG mockup (placeholder genérico)
const MOCK_QR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' shape-rendering='crispEdges'><rect width='100' height='100' fill='white'/>${Array.from({ length: 400 }).map((_, i) => {
  const x = (i % 20) * 5;
  const y = Math.floor(i / 20) * 5;
  // Pseudo-random pattern (deterministic)
  return ((i * 73 + 17) % 7 < 3) ? `<rect x='${x}' y='${y}' width='5' height='5' fill='black'/>` : "";
}).join("")}<rect x='5' y='5' width='25' height='25' fill='white' stroke='black' stroke-width='5'/><rect x='70' y='5' width='25' height='25' fill='white' stroke='black' stroke-width='5'/><rect x='5' y='70' width='25' height='25' fill='white' stroke='black' stroke-width='5'/></svg>`;

export function PixPaymentDialog({
  installment,
  open,
  onOpenChange,
}: {
  installment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [copying, setCopying] = useState(false);
  if (!installment) return null;

  const amount = Number(installment.amount);
  const pixPayload = installment.pix_payload ?? PIX_FALLBACK;
  const qrSrc = installment.pix_qrcode
    ? `data:image/png;base64,${installment.pix_qrcode}`
    : `data:image/svg+xml;utf8,${encodeURIComponent(MOCK_QR_SVG)}`;

  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    } finally {
      setTimeout(() => setCopying(false), 600);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" /> Pagar com PIX
          </DialogTitle>
          <DialogDescription>
            Vencimento {formatDate(installment.due_date)} — escaneie o QR Code ou copie o código.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold text-primary mt-1">{formatBRL(amount)}</p>
            <Badge variant="outline" className="mt-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Pix processado via Asaas
            </Badge>
          </div>

          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-lg border shadow-sm">
              <img src={qrSrc} alt="QR Code Pix" className="w-52 h-52" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pix Copia e Cola</p>
            <div className="font-mono text-xs break-all rounded-md border bg-muted/40 p-3 max-h-20 overflow-auto">
              {pixPayload}
            </div>
            <Button className="w-full" onClick={copy} disabled={copying}>
              {copying ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Copy className="size-4 mr-2" />}
              Copiar Código Copia e Cola
            </Button>
          </div>

          {installment.boleto_url && (
            <Button variant="outline" className="w-full" asChild>
              <a href={installment.boleto_url} target="_blank" rel="noreferrer">
                <Download className="size-4 mr-2" /> Visualizar Boleto PDF
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
