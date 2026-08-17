import sys
import re

def main():
    with open('full_schema.sql', 'r') as f:
        lines = f.readlines()

    new_lines = []
    
    # We will remove entire blocks of tables/policies/triggers if they are strictly Asaas/Stark
    remove_patterns = [
        r'asaas_accounts',
        r'asaas_customers',
        r'stark_charges',
        r'stark_events',
        r'stark_charge_kind',
        r'stark_charge_status',
        r'stark-process-payouts',
        r'stark-reconcile-charges',
        r'reconcile-stark-charges',
        r'asaas_payment_id',
        r'stark_charge_id',
        r'stark_transfer_id',
        r'landlord_payout_asaas_id',
        r'asaas_transfer_id',
        r'asaas-accounts',
        r'stark-events',
        r'asaas_account_id',
        r'asaas_customer_id',
        r'stark_id',
        r'stark_boleto_id',
        r'Asaas subaccounts',
        r'Asaas customer per tenant',
        r'STARK BANK MIGRATION'
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
        
        if should_remove:
            i += 1
            continue
        
        new_lines.append(line)
        i += 1

    with open('full_schema.sql', 'w') as f:
        f.writelines(new_lines)
    
    print(f"Successfully processed full_schema.sql. Removed lines matching Asaas/Stark patterns.")

if __name__ == '__main__':
    main()
