# Migration to Evolution API as Primary WhatsApp Gateway

This plan removes SendPulse integration and establishes Evolution API as the sole WhatsApp provider for Nexo.

## Proposed Changes

### WhatsApp Integration
- **Remove SendPulse logic**: Delete `src/lib/sendpulse.server.ts` and all its references.
- **Set Evolution API as primary**: Update `src/lib/whatsapp.server.ts` to use Evolution API directly without checking for SendPulse credentials.
- **Default Instance**: Set "Nexo suporte" as the default instance for Evolution API if not provided via environment variables.

### Notification Automation
- **Update Cron Jobs**: Simplify `src/lib/notifications-cron.server.ts` to send simple text messages via Evolution API instead of complex templates with variables.

### Cleanup
- **Remove test files**: Delete `src/lib/test-sendpulse.ts` if it exists.
- **Remove references**: Clean up any remaining comments or documentation mentioning SendPulse in the integration files.

## Technical Details
- **Sanitization**: Phone numbers will continue to be sanitized to the `55XXXXXXXXXXX` format.
- **Environment Variables**: The system will now rely exclusively on `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, and `EVOLUTION_API_INSTANCE`.
- **Fallbacks**: Removed logic that prioritizes SendPulse when `SENDPULSE_CLIENT_ID` is present.
