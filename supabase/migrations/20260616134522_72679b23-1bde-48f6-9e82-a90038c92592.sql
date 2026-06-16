CREATE OR REPLACE FUNCTION public.generate_installments_for_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  months_count INT;
  i INT;
  due DATE;
  base_date DATE;
  max_day INT;
  use_day INT;
  initial_status installment_status;
BEGIN
  months_count := (EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12
                  + EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date)))::INT;
  IF months_count < 1 THEN months_count := 1; END IF;

  FOR i IN 0..(months_count - 1) LOOP
    base_date := (date_trunc('month', NEW.start_date) + (i || ' month')::interval)::date;
    max_day := EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int;
    use_day := LEAST(NEW.due_day, max_day);
    due := make_date(EXTRACT(YEAR FROM base_date)::int, EXTRACT(MONTH FROM base_date)::int, use_day);

    -- Parcelas futuras nascem AGENDADAS (just-in-time). Vencimentos
    -- já passados ou dentro do horizonte imediato seguem como pendente
    -- para não bloquear contratos retroativos.
    IF due > (CURRENT_DATE + INTERVAL '15 days') THEN
      initial_status := 'agendado'::installment_status;
    ELSE
      initial_status := 'pendente'::installment_status;
    END IF;

    INSERT INTO public.installments (user_id, contract_id, due_date, amount, status)
    VALUES (NEW.user_id, NEW.id, due, NEW.rent_amount, initial_status);
  END LOOP;

  UPDATE public.properties SET status = 'alugado' WHERE id = NEW.property_id AND user_id = NEW.user_id;

  RETURN NEW;
END; $function$;