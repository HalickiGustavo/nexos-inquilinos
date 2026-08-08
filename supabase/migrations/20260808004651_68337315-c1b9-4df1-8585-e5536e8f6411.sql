-- Ensure profile exists
INSERT INTO public.profiles (id, email, full_name) 
VALUES ('58c2cc03-cb13-4724-8ddb-77d7143cea96', 'azure.cosmeticos2025@gmail.com', 'Azure Cosméticos')
ON CONFLICT (id) DO UPDATE SET full_name = 'Azure Cosméticos';

-- Assign manager role
INSERT INTO public.user_roles (user_id, role) 
VALUES ('58c2cc03-cb13-4724-8ddb-77d7143cea96', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;