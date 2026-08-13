# Plan: Migrate WhatsApp Gateway to WAHA

The user reported that the previous number was blocked and requested switching the WhatsApp gateway from Evolution API to WAHA.

## User Review Required
> [!IMPORTANT]
> To enable the new integration, you must configure the following environment variables in the Lovable dashboard (Secrets):
> - `WAHA_API_URL`: The base URL of your WAHA instance (e.g., `https://waha.example.com`).
> - `WAHA_API_SESSION`: (Optional) The session name. Defaults to `default`.
> - `WAHA_API_KEY`: (Optional) The API key for your WAHA instance.

## Technical Details
- Created `src/lib/waha.server.ts` to handle WAHA-specific API calls.
- Updated `src/lib/whatsapp.server.ts` to redirect all WhatsApp traffic to the WAHA gateway.
- Maintained backward compatibility by keeping the `sendWhatsAppText` and `sendEvolutionText` (deprecated) function signatures.
- Updated notification cron and server functions to use the abstracted `sendWhatsAppText` function.
- Created a temporary test route at `/api/public/test-whatsapp` to verify connectivity once secrets are provided.

## Next Steps
1. User provides secrets (`WAHA_API_URL`).
2. Run a test using `GET /api/public/test-whatsapp?phone=5541987771358&text=Teste+Nexo+via+WAHA`.
3. Verify successful message delivery.
