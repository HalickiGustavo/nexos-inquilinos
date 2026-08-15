# Review and Structural Improvement Plan - NEXO 2.0

## Objective
Implement a centralized monitoring and alert system to detect failures proactively and optimize system performance/scalability for growth.

## Phase 1: Monitoring & Automatic Alerts
- **Central Monitoring Infrastructure**: Create a `system_health_logs` table in Supabase to track technical issues, integration failures, and critical events (severity: INFO, WARNING, ERROR, CRITICAL).
- **Health Checks**: Implement a lightweight `/api/public/health` endpoint to monitor database, Edge Functions, and external integrations (Efí Bank, Evolution API).
- **Anomaly Detection**: Add logic to group/deduplicate errors to avoid notification floods.
- **Alert System**:
    - **Database Triggers**: Send notifications for critical events.
    - **Admin Dashboard**: Create a "System Health" view for administrators to monitor status, active incidents, and performance metrics.
- **Incident Management**: Implement an incident lifecycle (Detected -> Investigating -> Mitigated -> Resolved).

## Phase 2: Performance & Scalability
- **Server-Side Pagination & Filtering**:
    - Refactor list components (`TenantsManagement`, `PropertiesPage`, `Financeiro`) to use server-side pagination instead of loading all records.
    - Implement server-side search and filtering for all major tables.
- **Database Optimization**:
    - Add missing B-tree indexes for `tenant_id`, `property_id`, `contract_id`, `status`, and date fields.
    - Review and optimize RLS policies for multi-tenancy isolation.
- **Dashboard & Reports Optimization**:
    - Use consolidated queries and materialized views (or cached snapshots) for heavy dashboard metrics.
    - Optimize PDF/CSV export logic to handle large volumes asynchronously.
- **Frontend Optimization**:
    - Implement skeleton loading and lazy loading for heavy components.
    - Remove duplicate API calls and optimize TanStack Query cache settings (`staleTime`, `gcTime`).

## Technical Details
- **Stack**: React 19, TanStack Start/Query, Supabase (PostgreSQL, Edge Functions).
- **Security**: No credentials in frontend; structural RLS enforcement; PII protection in logs.
- **Monitoring Table**: `public.system_health_logs` (id, event_type, severity, service, tenant_id, user_id, error_message, stack_trace, metadata, created_at, resolved_at).

## Proposed UI Additions
- **Admin System Health Page**: Accessible to administrators with real-time status indicators and error charts.
- **Confirmation Modals**: Standardize confirmation dialogs for all financial and destructive actions.
- **Skeleton States**: Add skeletons to all high-traffic dashboard and list views.
