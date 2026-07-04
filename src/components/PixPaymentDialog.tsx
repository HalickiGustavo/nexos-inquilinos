import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate } from "@/lib/format";
import { checkPixPayment } from "@/lib/pix-split.functions";

/**
 * Modal de pagamento PIX — versão redesenhada (2026).
 * - Compacto, sem scroll interno, cabe no viewport em desktop e mobile.
 * - Sem splits, sem TXID, sem logs técnicos visíveis ao inquilino.
 * - Roxo apenas como acento; sem glow/neon.
 */
export function PixPaymentDialog({
  installment,
  open,
  onOpenChange,
  loading = false,
  error = null,
  debug: _debug = null,
  onPaid,
}: {
  installment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading?: boolean;
  error?: string | null;
  debug?: unknown | null;
  onPaid?: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [qrFallback, setQrFallback] = useState<string | null>(null);
  const checkPaid = useServerFn(checkPixPayment);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  // Polling: a cada 5s consulta o backend para detectar confirmação do Pix.
  useEffect(() => {
    if (!open || !installment?.id || !installment?.pix_payload || paid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res: any = await checkPaid({ data: { installmentId: installment.id } });
        if (!cancelled && res?.paid) {
          setPaid(true);
          toast.success("Pagamento confirmado com sucesso.");
          onPaidRef.current?.();
          // Fecha automaticamente após breve feedback visual.
          setTimeout(() => onOpenChange(false), 1600);
        }
      } catch { /* ignora — próxima rodada */ }
    };
    const id = setInterval(tick, 5000);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [open, installment?.id, installment?.pix_payload, paid, checkPaid, onOpenChange]);

  useEffect(() => { if (!open) { setPaid(false); setQrFallback(null); } }, [open]);

  // Total efetivo (mantém a mesma regra financeira — inclui split se existir).
  const amount = Number(installment?.split_breakdown?.total ?? installment?.amount ?? 0);
  const pixPayload: string | null = installment?.pix_payload ?? null;
  const qrFromServer = installment?.pix_qrcode
    ? `data:image/png;base64,${installment.pix_qrcode}`
    : null;
  const qrSrc = qrFromServer ?? qrFallback;

  // Fallback: se o servidor não devolveu QR mas temos o payload, geramos
  // localmente a partir do BRCode (mesmo conteúdo, mesma leitura no banco).
  useEffect(() => {
    if (!open || qrFromServer || !pixPayload) return;
    let cancelled = false;
    QRCode.toDataURL(pixPayload, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQrFallback(url); })
      .catch(() => { /* ignora — modo texto ainda funciona */ });
    return () => { cancelled = true; };
  }, [open, qrFromServer, pixPayload]);

  if (!installment) return null;

  const copy = async () => {
    if (!pixPayload) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("PIX copiado com sucesso.");
    } catch {
      toast.error("Não foi possível copiar");
    } finally {
      setTimeout(() => setCopying(false), 600);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border">
        <div className="p-5 sm:p-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-semibold">Pagamento via PIX</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escaneie o QR Code ou copie o código abaixo.
            </DialogDescription>
          </DialogHeader>

          {/* Valor em destaque */}
          <div className="mt-4 flex items-baseline justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor a pagar</p>
              <p className="text-3xl font-bold tabular-nums mt-0.5">{formatBRL(amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
              <p className="text-sm font-medium mt-0.5">{formatDate(installment.due_date)}</p>
            </div>
          </div>

          {/* Estado: loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Gerando código PIX…</p>
            </div>
          )}

          {/* Estado: erro */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <AlertCircle className="size-6 text-destructive" />
              <p className="text-sm font-medium">Não foi possível gerar o PIX</p>
              <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
            </div>
          )}

          {/* Estado: pronto */}
          {!loading && !error && qrSrc && pixPayload && (
            <div className="mt-4 space-y-4">
              {/* QR Code centralizado, borda discreta, sem glow */}
              <div className="flex justify-center">
                <div className="rounded-lg border border-border bg-white p-3">
                  <img
                    src={qrSrc}
                    alt="QR Code PIX"
                    className="block h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]"
                  />
                </div>
              </div>

              {/* Copia e cola compacto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">PIX Copia e Cola</p>
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2">
                    <p className="font-mono text-[11px] leading-tight text-muted-foreground truncate">
                      {pixPayload}
                    </p>
                  </div>
                  <Button
                    onClick={copy}
                    disabled={copying || paid}
                    size="sm"
                    className="shrink-0 px-3"
                  >
                    {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                    <span className="ml-1.5 hidden sm:inline">Copiar código</span>
                  </Button>
                </div>
              </div>

              {/* Status de aguardando / confirmado */}
              {paid ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Pagamento confirmado com sucesso.
                  </p>
                </div>
              ) : (
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento…
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
