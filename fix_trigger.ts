
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function fixAuditTrigger() {
  console.log("Adding audit trigger to properties table...");
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: `
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_properties') THEN
              CREATE TRIGGER trg_audit_properties
              AFTER INSERT OR UPDATE OR DELETE ON public.properties
              FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();
          END IF;
      END $$;
    `
  });
  
  if (error) {
    console.error("Error fixing trigger:", error);
  } else {
    console.log("Audit trigger fixed successfully.");
  }
}

fixAuditTrigger();
