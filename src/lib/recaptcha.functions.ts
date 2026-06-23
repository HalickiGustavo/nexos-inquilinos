import { createServerFn } from "@tanstack/react-start";

// Site key da reCAPTCHA é público (renderizado no HTML do widget).
// Expor via server fn permite trocar entre teste/produção mexendo só no secret.
export const getRecaptchaSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      siteKey:
        process.env.RECAPTCHA_SITE_KEY ??
        "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    };
  },
);
