import sys
import re

def main():
    with open('full_schema.sql', 'r') as f:
        lines = f.readlines()

    new_lines = []
    
    # We will remove entire blocks of tables/policies/triggers if they are strictly Asaas/Stark
    # Tables to remove: asaas_accounts, asaas_customers, stark_charges, stark_events
    # Types to remove: stark_charge_kind, stark_charge_status
    
    # We will also remove column additions to other tables:
    # installments: asaas_payment_id, stark_charge_id, boleto_url, pix_qrcode, pix_payload, barcode
    # payment_transfers: stark_transfer_id
    
    # Patterns that indicate a line should be removed
    remove_patterns = [
        r'\basaas_accounts\b',
        r'\basaas_customers\b',
        r'\bstark_charges\b',
        r'\bstark_events\b',
        r'\bstark_charge_kind\b',
        r'\bstark_charge_status\b',
        r'stark-process-payouts',
        r'stark-reconcile-charges',
        r'reconcile-stark-charges',
        r'asaas_payment_id',
        r'stark_charge_id',
        r'stark_transfer_id',
        r'landlord_payout_asaas_id',
        r'asaas_transfer_id',
        r'asaas-accounts',
        r'stark-events'
    ]

    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if line contains any remove patterns
        should_remove = False
        for p in remove_patterns:
            if re.search(p, line, re.IGNORECASE):
                should_remove = True
                break
        
        # Special case: multi-line column additions or policies
        # If a line starts a multi-line ALTER or CREATE related to these, we should be careful.
        # But for full_schema.sql, most are standard.
        
        if should_remove:
            # If it's a COMMENT or a single line command, just skip it
            i += 1
            continue
        
        # Keep the line
        new_lines.append(line)
        i += 1

    with open('full_schema.sql', 'w') as f:
        f.writelines(new_lines)
    
    print(f"Successfully processed full_schema.sql. Removed lines matching Asaas/Stark patterns.")

if __name__ == '__main__':
    main()
