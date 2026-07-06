
-- 1) Add user_id to bankroll, drop singleton
ALTER TABLE public.bankroll ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.bankroll SET user_id = (SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.bankroll ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.bankroll DROP CONSTRAINT IF EXISTS bankroll_singleton_key;
ALTER TABLE public.bankroll DROP COLUMN singleton;
ALTER TABLE public.bankroll ADD CONSTRAINT bankroll_user_unique UNIQUE (user_id);
ALTER TABLE public.bankroll ALTER COLUMN initial_amount SET DEFAULT 0;
ALTER TABLE public.bankroll ALTER COLUMN current_amount SET DEFAULT 0;

-- 2) Add user_id to bankroll_movements
ALTER TABLE public.bankroll_movements ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.bankroll_movements SET user_id = (SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.bankroll_movements ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movements_user ON public.bankroll_movements(user_id);

-- 3) Add user_id to bets (owner) - default from created_by
ALTER TABLE public.bets ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.bets SET user_id = COALESCE(created_by, (SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1)) WHERE user_id IS NULL;
ALTER TABLE public.bets ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id);

-- 4) Rewrite RLS on bets (owner-scoped; admin sees all)
DROP POLICY IF EXISTS "bets readable" ON public.bets;
DROP POLICY IF EXISTS "editors insert bets" ON public.bets;
DROP POLICY IF EXISTS "editors update bets" ON public.bets;
DROP POLICY IF EXISTS "admin delete bets" ON public.bets;

CREATE POLICY "bets: owner or admin read" ON public.bets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "bets: owner insert" ON public.bets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bets: owner or admin update" ON public.bets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "bets: owner or admin delete" ON public.bets FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

-- 5) Rewrite RLS on bankroll (owner-scoped)
DROP POLICY IF EXISTS "bankroll readable" ON public.bankroll;
DROP POLICY IF EXISTS "admin update bankroll" ON public.bankroll;
CREATE POLICY "bankroll: owner read" ON public.bankroll FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "bankroll: owner insert" ON public.bankroll FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bankroll: owner update" ON public.bankroll FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 6) Rewrite RLS on bankroll_movements (owner-scoped)
DROP POLICY IF EXISTS "movements readable" ON public.bankroll_movements;
DROP POLICY IF EXISTS "editors insert movements" ON public.bankroll_movements;
CREATE POLICY "movements: owner read" ON public.bankroll_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "movements: owner insert" ON public.bankroll_movements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7) Update handle_new_user to create a per-user bankroll at zero
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  INSERT INTO public.bankroll (user_id, initial_amount, current_amount) VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- 8) Update handle_bet_change to target the bet owner's bankroll
CREATE OR REPLACE FUNCTION public.handle_bet_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta NUMERIC(12,2) := 0;
  new_balance NUMERIC(12,2);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'pending' THEN
    NEW.closed_at := now();
    IF NEW.profit_loss IS NOT NULL THEN
      delta := NEW.profit_loss;
    ELSIF NEW.status = 'green' THEN
      delta := NEW.stake * (NEW.odd - 1);
      NEW.profit_loss := delta;
    ELSIF NEW.status = 'red' THEN
      delta := -NEW.stake;
      NEW.profit_loss := delta;
    ELSIF NEW.status = 'void' THEN
      delta := 0;
      NEW.profit_loss := 0;
    END IF;
    -- ensure bankroll row exists
    INSERT INTO public.bankroll (user_id, initial_amount, current_amount) VALUES (NEW.user_id, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.bankroll SET current_amount = current_amount + delta, updated_at = now()
      WHERE user_id = NEW.user_id
      RETURNING current_amount INTO new_balance;
    INSERT INTO public.bankroll_movements (bet_id, amount, type, description, balance_after, user_id)
      VALUES (NEW.id, delta, NEW.status::text, NEW.match || ' - ' || NEW.selection, new_balance, NEW.user_id);
  END IF;
  RETURN NEW;
END; $$;

-- 9) Backfill bankroll rows for any existing users without one
INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
SELECT p.id, 0, 0 FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.bankroll b WHERE b.user_id = p.id);
