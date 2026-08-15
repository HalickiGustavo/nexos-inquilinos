
-- 1. Create types first (with check)
do $$ begin
    create type public.system_health_severity as enum ('info', 'warning', 'error', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
    create type public.incident_status as enum ('detected', 'investigating', 'mitigated', 'resolved');
exception when duplicate_object then null; end $$;

-- 2. Create tables
create table if not exists public.system_health_logs (
    id uuid primary key default gen_random_uuid(),
    event_type text not null,
    severity public.system_health_severity not null default 'info',
    service text not null,
    tenant_id uuid,
    user_id uuid,
    endpoint text,
    error_message text,
    error_code text,
    stack_trace text,
    metadata jsonb default '{}'::jsonb,
    occurrence_count integer default 1,
    status public.incident_status not null default 'detected',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    resolved_at timestamp with time zone
);

create table if not exists public.system_alert_rules (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    event_type text not null,
    threshold integer not null,
    time_window_minutes integer not null,
    severity public.system_health_severity not null,
    is_active boolean default true,
    channels text[] default '{email}'::text[],
    created_at timestamp with time zone default now()
);

-- 3. RLS and Grants
grant select on public.system_health_logs to authenticated;
grant all on public.system_health_logs to service_role;
alter table public.system_health_logs enable row level security;

grant select on public.system_alert_rules to authenticated;
grant all on public.system_alert_rules to service_role;
alter table public.system_alert_rules enable row level security;

-- Policies (Correct role is 'platform_admin')
do $$ begin
    create policy "Admins can see health logs"
    on public.system_health_logs
    for select
    to authenticated
    using (public.has_role(auth.uid(), 'platform_admin'::public.app_role));
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "Admins can manage alert rules"
    on public.system_alert_rules
    for all
    to authenticated
    using (public.has_role(auth.uid(), 'platform_admin'::public.app_role));
exception when duplicate_object then null; end $$;

-- 4. Indexes
create index if not exists idx_system_health_logs_type_service on public.system_health_logs(event_type, service, status);
create index if not exists idx_system_health_logs_severity on public.system_health_logs(severity);
create index if not exists idx_system_health_logs_created_at on public.system_health_logs(created_at);

create index if not exists idx_contracts_tenant_id on public.contracts(tenant_id);
create index if not exists idx_contracts_property_id on public.contracts(property_id);
create index if not exists idx_contracts_due_day on public.contracts(due_day);
create index if not exists idx_contracts_active on public.contracts(active);
create index if not exists idx_contracts_deleted_at on public.contracts(deleted_at);

create index if not exists idx_installments_contract_id on public.installments(contract_id);
create index if not exists idx_installments_status on public.installments(status);
create index if not exists idx_installments_due_date on public.installments(due_date);
create index if not exists idx_installments_payment_date on public.installments(payment_date);

create index if not exists idx_properties_user_id on public.properties(user_id);
create index if not exists idx_properties_status on public.properties(status);

create index if not exists idx_maintenances_property_id on public.maintenances(property_id);
create index if not exists idx_maintenances_tenant_id on public.maintenances(tenant_id);
create index if not exists idx_maintenances_status on public.maintenances(status);

-- 5. Seed basic rules
insert into public.system_alert_rules (name, event_type, threshold, time_window_minutes, severity)
values 
('High Error Rate', 'http_5xx', 50, 5, 'critical'),
('Efí Integration Failure', 'efi_api_error', 5, 10, 'critical'),
('Webhook Processing Stall', 'webhook_idle', 1, 30, 'error')
on conflict do nothing;
