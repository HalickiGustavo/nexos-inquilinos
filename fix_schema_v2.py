import sys

with open('full_schema.sql', 'r') as f:
    lines = f.readlines()

# Correcting the broken lines after cleanup_schema.py messed up
# We know the context:
# Line 353 (original) became id uuid...
# We inserted CREATE TABLE public.efi_accounts ( at 352 (0-indexed)

# Let's fix lines 363-364 and the second table
# Original 363:   FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
# Original 364:   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

# We need to find the specific content to replace it reliably

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    
    # Fix efi_accounts RLS and Trigger
    if "  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);" in line and i > 0 and ");" in lines[i-1]:
        # Check if it belongs to efi_accounts (preceded by status text, updated_at etc)
        new_lines.append("ALTER TABLE public.efi_accounts ENABLE ROW LEVEL SECURITY;\n")
        new_lines.append("CREATE POLICY \"Users manage own efi_account\" ON public.efi_accounts\n")
        new_lines.append(line)
        new_lines.append("CREATE TRIGGER trg_efi_accounts_updated BEFORE UPDATE ON public.efi_accounts\n")
        continue

    # Fix efi_credentials table header
    if "  id uuid PRIMARY KEY DEFAULT gen_random_uuid()," in line and i > 0 and line == lines[367]: # Approximate position
         new_lines.append("CREATE TABLE public.efi_credentials (\n")
         new_lines.append(line)
         continue
         
    # Fix efi_credentials RLS and Trigger (similar pattern)
    if "  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);" in line and "efi_credentials" not in "".join(new_lines[-5:]):
         # If we are after efi_credentials definition
         new_lines.append("ALTER TABLE public.efi_credentials ENABLE ROW LEVEL SECURITY;\n")
         new_lines.append("CREATE POLICY \"Users manage own efi_credentials\" ON public.efi_credentials\n")
         new_lines.append(line)
         new_lines.append("CREATE TRIGGER trg_efi_credentials_updated BEFORE UPDATE ON public.efi_credentials\n")
         continue
         
    new_lines.append(line)

with open('full_schema.sql', 'w') as f:
    f.writelines(new_lines)
