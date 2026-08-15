# Plan - Implement Confirmation Dialogs for Critical Actions

Adding confirmation dialogs for deletion and financial actions in the manager area to prevent accidental operations.

## User Review Required
> [!IMPORTANT]
> The confirmation dialogs will use the standard project `useConfirm` hook which provides a consistent UI.

## Proposed Changes

### 1. Finance Area (Financial Actions)
- **Mark as Paid:** Add confirmation before marking an installment as paid manually.
- **Confirm Payout (Repasse):** Add confirmation before confirming a payout to a landlord.
- **Generate/Update Boleto:** Add confirmation when generating or updating a payment charge.

### 2. Deletion Actions (Consistency Check)
- **Team Management:** Add confirmation before removing a team member.
- **Contract PDF:** Add confirmation before removing a contract PDF (verified: already exists, will ensure consistency).
- **Inspections:** Add confirmation before deleting an inspection (verified: already exists).
- **Properties:** Add confirmation before deleting a property (verified: already exists).
- **Tenants:** Add confirmation before removing a tenant (verified: already exists).

### Technical Details
- Use `useConfirm` hook in `src/routes/_manager/manager.financeiro.tsx` and `src/routes/_manager/manager.equipe.tsx`.
- Update the `onClick` handlers to await the confirmation result.
- Ensure `ConfirmProvider` is available (it is already in `__root.tsx` or similar).

## Verification Plan
- **Manual Verification:**
    - Navigate to Financeiro > Recebimentos and click "Pago". Verify dialog appears.
    - Navigate to Financeiro > Repasses and click "Confirmar". Verify dialog appears.
    - Navigate to Equipe and click "Remover". Verify dialog appears.
- **Automated Verification:**
    - Run build to ensure no syntax errors.
