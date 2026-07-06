import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

// Chave pública de TESTE oficial do Google — usada apenas como fallback
// quando o secret `RECAPTCHA_SITE_KEY` não estiver configurado (ex: dev local).
// Ref: https://developers.google.com/recaptcha/docs/faq
const GOOGLE_TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

/**
 * Detecta se a requisição vem do ambiente de PREVIEW da Lovable
 * (`id-preview--<uuid>.lovable.app`) ou de desenvolvimento local.
 * Nesses casos o reCAPTCHA fica desligado para agilizar o teste.
 * Em qualquer outro host (published `*.lovable.app` ou domínio customizado)
 * o reCAPTCHA volta a ser exigido.
 */
function isPreviewHost(host: string | undefined): boolean {
  if (!host) return true; // por segurança em SSR sem header, trate como preview
  const h = host.toLowerCase();
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return true;
  if (h.includes("id-preview--")) return true; // preview URL da Lovable
  if (h.endsWith("-dev.lovable.app")) return true; // preview estável
  return false;
}

export const getRecaptchaSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const host =
      getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
    const preview = isPreviewHost(host);
    const siteKey = process.env.RECAPTCHA_SITE_KEY?.trim();

    // No preview: desliga o widget de vez.
    if (preview) {
      return { siteKey: null as string | null, enabled: false };
    }

    // Em produção: usa o secret; se ausente, cai para chave de teste do Google
    // (mantém o form renderizável, mas loga aviso implícito via ausência do secret).
    return {
      siteKey: siteKey && siteKey.length > 0 ? siteKey : GOOGLE_TEST_SITE_KEY,
      enabled: true,
    };
  },
);
