import { createServerFn } from "@tanstack/react-start";

// Site key da reCAPTCHA — temporariamente fixado na chave de TESTE do Google.
// Os secrets de produção (RECAPTCHA_SITE_KEY / RECAPTCHA_SECRET_KEY) permanecem
// armazenados nos secrets do projeto e podem ser religados depois.
export const getRecaptchaSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      siteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    };
  },
);
