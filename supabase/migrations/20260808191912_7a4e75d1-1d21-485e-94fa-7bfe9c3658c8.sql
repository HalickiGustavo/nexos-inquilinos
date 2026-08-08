-- Delete installments associated with the user's contracts
DELETE FROM public.installments 
WHERE contract_id IN (
  SELECT id FROM public.contracts 
  WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de'
);

-- Delete the contracts themselves
DELETE FROM public.contracts 
WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de';