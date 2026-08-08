-- Primeiro, apagamos as parcelas vinculadas aos contratos do usuário
DELETE FROM public.installments 
WHERE contract_id IN (
    SELECT id FROM public.contracts WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de'
);

-- Depois, apagamos os contratos do usuário
DELETE FROM public.contracts 
WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de';
