import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const inspectSchema = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*').limit(1);
    const { data: userRoles } = await supabaseAdmin.from('user_roles').select('*').limit(1);
    const { data: tenants } = await supabaseAdmin.from('tenants').select('*').limit(1);
    const { data: properties } = await supabaseAdmin.from('properties').select('*').limit(1);

    return { 
      profileColumns: profiles?.length ? Object.keys(profiles[0]) : [],
      userRoleColumns: userRoles?.length ? Object.keys(userRoles[0]) : [],
      tenantColumns: tenants?.length ? Object.keys(tenants[0]) : [],
      propertyColumns: properties?.length ? Object.keys(properties[0]) : []
    };
  });