
-- Remove obsolete services (nomes eram resultados, não serviços)
DELETE FROM public.services WHERE code IN ('greenite_spread', 'mutation_detected');

-- Add image_urls to bets
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage policies for bet-prints (private bucket, path = <userId>/<file>)
DROP POLICY IF EXISTS "bet-prints owner read" ON storage.objects;
CREATE POLICY "bet-prints owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bet-prints' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "bet-prints owner insert" ON storage.objects;
CREATE POLICY "bet-prints owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bet-prints' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bet-prints owner update" ON storage.objects;
CREATE POLICY "bet-prints owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bet-prints' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bet-prints owner or admin delete" ON storage.objects;
CREATE POLICY "bet-prints owner or admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bet-prints' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

-- Improved reset_my_data
CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  initial_val NUMERIC(12,2);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT initial_amount INTO initial_val FROM public.bankroll WHERE user_id = uid;
  IF initial_val IS NULL THEN initial_val := 0; END IF;

  ALTER TABLE public.bets DISABLE TRIGGER trg_bet_change;
  ALTER TABLE public.bets DISABLE TRIGGER trg_bet_audit;
  ALTER TABLE public.bets DISABLE TRIGGER trg_bet_delete;

  DELETE FROM public.bankroll_movements WHERE user_id = uid;
  DELETE FROM public.audit_log WHERE user_id = uid;
  DELETE FROM public.bets WHERE user_id = uid;

  ALTER TABLE public.bets ENABLE TRIGGER trg_bet_change;
  ALTER TABLE public.bets ENABLE TRIGGER trg_bet_audit;
  ALTER TABLE public.bets ENABLE TRIGGER trg_bet_delete;

  INSERT INTO public.bankroll (user_id, initial_amount, current_amount)
    VALUES (uid, initial_val, initial_val)
  ON CONFLICT (user_id) DO UPDATE SET current_amount = EXCLUDED.initial_amount, updated_at = now();
END;
$function$;
