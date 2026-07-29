/**
 * Detecção client-side de ambiente de preview/dev da Lovable.
 * Complementa a detecção via header no servidor (que nem sempre recebe
 * o host real do preview por trás do proxy).
 */
export function isPreviewClient(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("127.0.0.1") ||
    h.includes("id-preview--") ||
    h.includes(".lovableproject.com") ||
    h.endsWith("-dev.lovable.app") ||
    h.endsWith(".sandbox.lovable.dev")
  );
}
