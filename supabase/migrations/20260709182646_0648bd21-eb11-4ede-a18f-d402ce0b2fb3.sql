CREATE OR REPLACE FUNCTION public.log_bet_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.resetting_data', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, entity, entity_id, changes)
    VALUES (auth.uid(), 'insert', 'bet', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, entity, entity_id, changes)
    VALUES (auth.uid(), 'update', 'bet', NEW.id, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, entity, entity_id, changes)
    VALUES (auth.uid(), 'delete', 'bet', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_bet_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delta NUMERIC(12,2);
  new_balance NUMERIC(12,2);
BEGIN
  IF current_setting('app.resetting_data', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF OLD.status <> 'pending' AND COALESCE(OLD.profit_loss, 0) <> 0 THEN
    delta := -COALESCE(OLD.profit_loss, 0);
    INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
      VALUES (OLD.user_id, 0, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.bankroll SET current_amount = current_amount + delta, updated_at = now()
      WHERE user_id = OLD.user_id RETURNING current_amount INTO new_balance;
    INSERT INTO public.bankroll_movements (amount, type, description, balance_after, user_id)
      VALUES (delta, 'delete', 'Aposta apagada: ' || COALESCE(OLD.match,''), new_balance, OLD.user_id);
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  initial_val NUMERIC(12,2);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT initial_amount INTO initial_val FROM public.bankroll WHERE user_id = uid;
  IF initial_val IS NULL THEN
    initial_val := 0;
  END IF;

  PERFORM set_config('app.resetting_data', 'on', true);

  DELETE FROM public.bets WHERE user_id = uid;
  DELETE FROM public.bankroll_movements WHERE user_id = uid;
  DELETE FROM public.audit_log WHERE user_id = uid;

  INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
    VALUES (uid, initial_val, initial_val)
  ON CONFLICT (user_id) DO UPDATE
    SET current_amount = EXCLUDED.initial_amount,
        updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_my_data() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;