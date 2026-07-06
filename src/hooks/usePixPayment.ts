// Hook único de fluxo PIX (split triplo Nexo/Imobiliária/Proprietário).
//
// Consolidado a partir da duplicação encontrada em `tenant.index.tsx` e
// `tenant.financeiro.tsx` — ambos mantinham 4 states + `openPix` idênticos.
// Motivos para centralizar:
//  - toda mudança em geração/erro/telemetria precisava ser feita em 2 lugares;
//  - risco de divergência silenciosa entre telas do inquilino;
//  - simplifica montagem do `PixPaymentDialog` (props uniformes).
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { generateTripleSplitPix } from "@/lib/pix-split.functions";

export type UsePixPaymentOptions = {
  /** Query keys a invalidar após gerar/confirmar PIX. */
  invalidateKeys?: readonly (readonly (string | number)[])[];
};

export function usePixPayment(opts?: UsePixPaymentOptions) {
  const tripleSplit = useServerFn(generateTripleSplitPix);
  const queryClient = useQueryClient();

  const [installment, setInstallment] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<unknown | null>(null);

  const invalidate = useCallback(() => {
    for (const key of opts?.invalidateKeys ?? []) {
      queryClient.invalidateQueries({ queryKey: key as any });
    }
  }, [queryClient, opts?.invalidateKeys]);

  const open = useCallback(
    async (i: any) => {
      setInstallment(i);
      setError(null);
      setDebug(null);
      if (i?.pix_qrcode && i?.pix_payload) return;
      setLoading(true);
      try {
        const res: any = await tripleSplit({ data: { installmentId: i.id } });
        if (!res?.ok) {
          setError(res?.error ?? "Não foi possível gerar o PIX no momento.");
          setDebug(res?.debug ?? null);
          return;
        }
        setInstallment({
          ...i,
          pix_qrcode: res.qrCodeBase64,
          pix_payload: res.pixPayload,
          split_breakdown: res.breakdown,
        });
        invalidate();
      } catch (e: any) {
        setError(e?.message ?? "Erro ao gerar PIX");
        setDebug({
          at: new Date().toISOString(),
          source: "client",
          message: e?.message ?? String(e),
          name: e?.name ?? null,
        });
      } finally {
        setLoading(false);
      }
    },
    [tripleSplit, invalidate],
  );

  const close = useCallback(() => {
    setInstallment(null);
    setError(null);
    setDebug(null);
    setLoading(false);
    invalidate();
  }, [invalidate]);

  const dialogProps = useMemo(
    () => ({
      installment,
      open: !!installment,
      loading,
      error,
      debug,
      onOpenChange: (o: boolean) => {
        if (!o) close();
      },
      onPaid: invalidate,
    }),
    [installment, loading, error, debug, close, invalidate],
  );

  return { open, close, dialogProps, installment, loading, error, debug };
}
