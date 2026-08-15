# NEXO Production Integrity & Security Audit Plan

This plan addresses four critical points requested for the NEXO platform, focusing on financial integrity, multi-tenant isolation, idempotency, and data consistency.

## 1. Financial Destination Integrity (PIX/Boleto)
**Current Risk:** Frontend-provided IDs might be used to determine payment recipients.
**Fix:** Implement a server-side "Trust Chain" that reconstructs relationships from the database.

- **Action:** Refactor `generateTripleSplitPix` in `src/lib/pix-split.functions.ts`.
- **Action:** Refactor `confirmEfiChargePaid` and `enqueueSplitForInstallment` in `src/lib/efi/webhook.server.ts`.
- **Logic:**
  1. Input: `installmentId`.
  2. Lookup: `installment` -> `contract` -> `property` -> `landlord`.
  3. Validate: `contract.active`, `property.manager_id` matches user's agency.
  4. Fetch recipient PIX keys directly from `profiles` (landlord) and `agency_settings`.
  5. Never use a PIX key or amount passed from the frontend for splits.

## 2. Multi-Tenant Isolation
**Current Risk:** RLS policies exist but need verification for all entities.
**Fix:** Audit and harden RLS for `properties`, `tenants`, `contracts`, `installments`, and `efi_charges`.

- **SQL Migration:**
  - Ensure all tables have `manager_id` or `user_id` (representing the agency).
  - Enforce `authenticated` role access only via `current_manager_id()`.
  - Add `CHECK` constraints to prevent cross-tenant ID linking (e.g., contract in property A belonging to manager B).

## 3. Financial Reconcilliation & Idempotency
**Current Risk:** Webhooks might process duplicate events or accept incorrect amounts.
**Fix:** Implement strict value validation and idempotent event logging.

- **Action:** Modify `processEfiWebhookPayload` in `src/lib/efi/webhook.server.ts`.
- **Logic:**
  - `efi_events` table already exists; ensure `event_id` or `txid` is used as a unique constraint.
  - In `confirmEfiChargePaid`, compare `paidAmount` from Efí against `installment.amount + nexo_flat_fee`.
  - If `paidAmount < total_expected`, mark status as `DIVERGENT` (new status) and block automatic payout.
  - Use `NUMERIC` for all currency math (already in schema, verified).

## 4. Email Confirmation & Registration Flow
**Current Risk:** User registration might fail silently or bypass email verification.
**Fix:** Audit Supabase Auth config and registration triggers.

- **Action:** Review `src/routes/cadastro.tsx`.
- **Action:** Verify Resend integration in `src/lib/invite-sync.functions.ts` or similar.
- **Backend:** Ensure `auth.users.email_confirmed_at` is checked before allowing access to manager/landlord dashboards.

## 5. Atomic Registrations (Transactions)
**Current Risk:** Partial saves (e.g., property created but landlord link fails).
**Fix:** Use Supabase RPC or server-side logic that performs rollbacks on failure.

- **Action:** Create a `create_property_with_landlord` RPC to handle atomic creation.

## Technical Details
- **Tables affected:** `efi_charges`, `installments`, `contracts`, `payment_transfers`.
- **Files affected:** `src/lib/pix-split.functions.ts`, `src/lib/efi/webhook.server.ts`, `src/lib/financial-engine.server.ts`.
- **Database:** New migration for `verify_payout_integrity` enhancements and `DIVERGENT` status.
