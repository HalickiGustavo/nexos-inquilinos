# Plan: Nexo Reports & Safety Improvements

Enhance the Agency (Manager) dashboard and financial module with comprehensive reports and safety measures for critical operations, ensuring a production-ready environment.

## User Review Required

> [!IMPORTANT]
> - **Excel Exports**: I'll use `xlsx` for CSV-based exports if complex formatting is needed, or stick to robust CSV/PDF as currently implemented.
> - **Report Access**: Reports will be accessible via a dedicated "Relatórios" tab and also integrated into the Finance dashboard.

## Proposed Changes

### 1. Reports Module (Relatórios)
- **Comprehensive Agency Reports**: Implement a new report suite that tracks:
    - **Monthly Revenue**: Total income received vs. pending.
    - **Landlord Payouts**: Detailed tracking of how much was transferred to each property owner.
    - **Default/Arrears Tracking**: List of tenants with overdue payments.
    - **High-Yield Properties**: Ranking of properties by net revenue.
- **Export Capabilities**:
    - **PDF**: Detailed, branded PDF statements for internal use and owners.
    - **Excel/CSV**: Clean data exports for accounting software (DIMOB/CRM).
- **Location**: Update `src/routes/_manager/manager.relatorios.tsx` to provide a dedicated experience (currently it just wraps the landlord view).

### 2. Safety & Confirmations (UX/Security)
- **Mass Deletion Protection**: Add confirmation dialogs to all critical delete actions in the Manager area (already partially done, will verify coverage).
- **Financial Critical Actions**: Add confirmations for:
    - **Manual Payment Confirmation**: Prevent accidental "Mark as Paid".
    - **Repasse (Payout) Trigger**: Ensure payouts to landlords are intentional.
    - **Charge Generation**: Avoid duplicate billing.

### 3. Data Integrity & Visualization
- **Live Metrics**: Ensure the Bento-grid dashboard in `manager.index.tsx` is 100% reactive to real-time database changes.
- **PDF Template Improvement**: Enhance `downloadPdf` in `src/lib/pdf.ts` to support multi-column layouts and better headers for agency reports.

## Technical Details

- **Libraries**: `jspdf` for PDF generation, standard `recharts` for visualization.
- **Database**: Use existing `installments` and `contracts` tables with optimized queries.
- **Components**: Create `AgencyReportSummary` and `PayoutTracker` components.
- **Security**: All report endpoints and data fetches will respect existing Manager-level RLS.
