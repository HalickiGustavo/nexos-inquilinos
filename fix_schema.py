import sys

with open('full_schema.sql', 'r') as f:
    lines = f.readlines()

# Line 353 (1-indexed) is lines[352]
# We suspect these were part of efi_accounts and efi_credentials that got their CREATE TABLE headers deleted

# Re-insert the headers if missing
# Line 353:   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
# Line 365:   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

if '  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' in lines[352]:
    lines.insert(352, 'CREATE TABLE public.efi_accounts (\n')
    # The closing ); is at 361 (relative to original 353 start)
    # The RLS/Trigger lines are at 362, 363 (relative to original 353 start)
    # But wait, 362 is "  FOR ALL TO authenticated..." - it's missing the "CREATE POLICY ... ON ... " part too?
    
if '  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' in lines[365+1]: # +1 because of the insert above
    lines.insert(365+1, 'CREATE TABLE public.efi_credentials (\n')

with open('full_schema.sql', 'w') as f:
    f.writelines(lines)
