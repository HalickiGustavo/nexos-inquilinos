# Dashboard Evolution Plan - UI/UX + Operational KPIs

This plan outlines a careful evolution of the existing real estate management dashboard, transforming it into a functional "operation center" while preserving the current visual identity and business logic.

## Objectives
- Enhance clarity and visual hierarchy.
- Provide immediate answers to critical operational questions (Revenue, Arrears, Payouts, Vacancy).
- Implement an "Attention Required" section for actionable items.
- Ensure full responsiveness and performance.

## Proposed Changes

### 1. Header & Period Selection
- **Refinement**: Maintain current greeting and "Portfolio Summary" description.
- **Dynamic Insight**: Update the subtile to reflect current status (e.g., "4 cobranças em atraso" or "Tudo em dia").
- **Date Range Picker**: Preserve the current component but ensure it consistently filters all period-dependent metrics.

### 2. Operational KPIs (PortfolioSummary Evolution)
- **Financial KPIs**:
    - **Received**: Value received in period + comparison.
    - **To Receive**: Pending payments for the period.
    - **Arrears (Inadimplência)**: Value + % and trend.
    - **To Payout (A Repassar)**: Pending payouts to owners.
- **Portfolio KPIs**:
    - **Active Contracts**: Total count + trend.
    - **Occupancy Rate**: Percentage + "X of Y occupied" text + discrete progress bar.
    - **Available Properties**: Count + % of portfolio.
    - **Expiring Contracts**: Count within next 30 days.

### 3. "Attention Required" Section
- New operational area showing actionable alerts:
    - Overdue payments.
    - Contracts expiring soon.
    - Pending maintenance approvals.
    - Payouts awaiting processing.
- Items will be clickable, linking to relevant filtered pages.

### 4. Financial Charts & Lists
- **Recebimentos Chart**: Rename "Faturamento" to "Recebimentos" for clarity. Add toggle for "Repasses" if architecture permits.
- **Upcoming Due Dates**: Refine table to prioritize Tenant, Property, Due Date, Value, and Status with discrete badges.
- **Recent Activity**: Standardize icons and descriptions for contracts, payments, maintenance, and leads.

### 5. Maintenance Summary
- Add a summarized view of maintenance states (Open, Pending Approval, In Progress, Awaiting Quote).

## Technical Details
- **Implementation**: Modify `src/routes/_manager/manager.index.tsx` and related components (`PortfolioSummary.tsx`).
- **Data Integrity**: Use existing Supabase queries and RLS; do not invent or hardcode data.
- **UX/UI**: Use Tailwind CSS for the bento-style layout refinement. Preserve purple/indigo theme.
- **Performance**: Consolidate queries where possible using `useQueries` to avoid waterfall requests.
- **Responsiveness**: Ensure 4-column desktop, 2-column tablet, and 1-column mobile layouts.

## Verification Plan
- **Manual Test**: Verify all KPIs reflect real database counts and values.
- **Interactive Test**: Check all links/filters navigate to the correct pre-filtered pages.
- **Visual Audit**: Verify responsiveness across viewports.
- **Security Check**: Ensure RLS remains strictly enforced.
