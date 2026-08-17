
with open('full_schema.sql', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Correcting the second table (efi_credentials) and its policies
    if "  id uuid PRIMARY KEY DEFAULT gen_random_uuid()," in line and i > 360 and "CREATE TABLE" not in lines[i-1]:
        new_lines.append("CREATE TABLE public.efi_credentials (\n")
        new_lines.append(line)
        i += 1
        continue
    
    # Fix efi_credentials RLS/Policies that were incorrectly applied to efi_accounts again
    if i > 370 and "ALTER TABLE public.efi_accounts ENABLE ROW LEVEL SECURITY;" in line:
        new_lines.append("ALTER TABLE public.efi_credentials ENABLE ROW LEVEL SECURITY;\n")
        new_lines.append("CREATE POLICY \"Users manage own efi_credentials\" ON public.efi_credentials\n")
        new_lines.append("  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);\n")
        new_lines.append("CREATE TRIGGER trg_efi_credentials_updated BEFORE UPDATE ON public.efi_credentials\n")
        new_lines.append("  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();\n")
        i += 5 # Skip the duplicate efi_accounts blocks we added in v2
        continue
        
    new_lines.append(line)
    i += 1

with open('full_schema.sql', 'w') as f:
    f.writelines(new_lines)
