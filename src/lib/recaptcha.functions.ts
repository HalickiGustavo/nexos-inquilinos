import { createServerFn } from "@tanstack/react-start";

// Chave pública do reCAPTCHA. Em produção usa o secret RECAPTCHA_SITE_KEY.
// Se o secret não estiver configurado, cai para a chave de TESTE oficial do
// Google (documentada em https://developers.google.com/recaptcha/docs/faq)
// apenas para que o formulário continue renderizando em desenvolvimento.
const GOOGLE_TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

export const getRecaptchaSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const siteKey = process.env.RECAPTCHA_SITE_KEY?.trim();
    return {
      siteKey: siteKey && siteKey.length > 0 ? siteKey : GOOGLE_TEST_SITE_KEY,
    };
  },
);
