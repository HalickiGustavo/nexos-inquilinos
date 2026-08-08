
-- Excluir da tabela user_roles se houver (previne erro de FK se não for cascade)
DELETE FROM public.user_roles WHERE user_id IN ('059ca7d8-147c-40ad-9b47-3d129089604c', '58c2cc03-cb13-4724-8ddb-77d7143cea96', 'b72b5333-2174-4e04-84d2-6e6edde76b1c');

-- Excluir perfis
DELETE FROM public.profiles WHERE id IN ('059ca7d8-147c-40ad-9b47-3d129089604c', '58c2cc03-cb13-4724-8ddb-77d7143cea96', 'b72b5333-2174-4e04-84d2-6e6edde76b1c');

-- Nota: A exclusão da tabela auth.users geralmente requer privilégios de superuser ou o uso do cliente admin do Supabase via código. 
-- Vou tentar remover o que for possível no schema public primeiro.
