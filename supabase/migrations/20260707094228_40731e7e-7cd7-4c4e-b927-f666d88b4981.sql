
-- 1. Make service_id optional
ALTER TABLE public.bets ALTER COLUMN service_id DROP NOT NULL;

-- 2. Improved bet change handler: handles closing, profit_loss corrections on closed bets, and DELETE
CREATE OR REPLACE FUNCTION public.handle_bet_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC(12,2) := 0;
  new_balance NUMERIC(12,2);
  old_pl NUMERIC(12,2);
  new_pl NUMERIC(12,2);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Case A: status transitions from pending to closed status
    IF OLD.status = 'pending' AND NEW.status <> 'pending' THEN
      NEW.closed_at := now();
      IF NEW.profit_loss IS NULL THEN
        IF NEW.status = 'green' THEN NEW.profit_loss := NEW.stake * (NEW.odd - 1);
        ELSIF NEW.status = 'red' THEN NEW.profit_loss := -NEW.stake;
        ELSE NEW.profit_loss := 0;
        END IF;
      END IF;
      delta := COALESCE(NEW.profit_loss, 0);

      INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
        VALUES (NEW.user_id, 0, 0) ON CONFLICT (user_id) DO NOTHING;
      UPDATE public.bankroll SET current_amount = current_amount + delta, updated_at = now()
        WHERE user_id = NEW.user_id RETURNING current_amount INTO new_balance;
      INSERT INTO public.bankroll_movements (bet_id, amount, type, description, balance_after, user_id)
        VALUES (NEW.id, delta, NEW.status::text, COALESCE(NEW.match,'') || ' - ' || COALESCE(NEW.selection,''), new_balance, NEW.user_id);

    -- Case B: bet was already closed, and profit_loss (or status among closed) changed → adjust delta
    ELSIF OLD.status <> 'pending' AND (
        COALESCE(NEW.profit_loss, 0) <> COALESCE(OLD.profit_loss, 0)
        OR NEW.status <> OLD.status
    ) THEN
      old_pl := COALESCE(OLD.profit_loss, 0);
      -- If user cleared profit_loss with a status change, recompute default
      IF NEW.profit_loss IS NULL THEN
        IF NEW.status = 'green' THEN NEW.profit_loss := NEW.stake * (NEW.odd - 1);
        ELSIF NEW.status = 'red' THEN NEW.profit_loss := -NEW.stake;
        ELSE NEW.profit_loss := 0;
        END IF;
      END IF;
      new_pl := COALESCE(NEW.profit_loss, 0);
      delta := new_pl - old_pl;

      -- Case B1: reverted to pending → undo original impact fully
      IF NEW.status = 'pending' THEN
        delta := -old_pl;
        NEW.closed_at := NULL;
        NEW.profit_loss := NULL;
      END IF;

      IF delta <> 0 THEN
        INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
          VALUES (NEW.user_id, 0, 0) ON CONFLICT (user_id) DO NOTHING;
        UPDATE public.bankroll SET current_amount = current_amount + delta, updated_at = now()
          WHERE user_id = NEW.user_id RETURNING current_amount INTO new_balance;
        INSERT INTO public.bankroll_movements (bet_id, amount, type, description, balance_after, user_id)
          VALUES (NEW.id, delta, 'adjust', 'Ajuste: ' || COALESCE(NEW.match,''), new_balance, NEW.user_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Handler for DELETE (reverse profit_loss impact on bankroll)
CREATE OR REPLACE FUNCTION public.handle_bet_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC(12,2);
  new_balance NUMERIC(12,2);
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_bet_delete ON public.bets;
CREATE TRIGGER trg_bet_delete BEFORE DELETE ON public.bets
  FOR EACH ROW EXECUTE FUNCTION public.handle_bet_delete();

-- 4. Reset function: lets a user wipe their own data (or admin resetting themselves)
CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  -- Nullify bet references in movements to allow bet deletes cleanly, then remove movements
  DELETE FROM public.bankroll_movements WHERE user_id = uid;
  DELETE FROM public.audit_log WHERE user_id = uid AND entity = 'bet';
  DELETE FROM public.bets WHERE user_id = uid;
  UPDATE public.bankroll SET initial_amount = 0, current_amount = 0, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
    VALUES (uid, 0, 0) ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_my_data() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
