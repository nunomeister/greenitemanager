
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.bet_status AS ENUM ('pending', 'green', 'red', 'void', 'cashout');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services readable" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.services (code, name, emoji, color, description, sort_order) VALUES
  ('meisters_pick', 'Meister''s Pick', '🎩', '#d4af37', 'Aposta principal do dia', 1),
  ('greenite_detected', 'Greenite Detected', '🦠', '#39ff14', 'Apostas pré-live', 2),
  ('infection_alert', 'Infection Alert', '☣️', '#f59e0b', 'Alertas live', 3),
  ('greenite_spread', 'Greenite Spread', '🟢', '#22c55e', 'Apostas fechadas como green', 4),
  ('mutation_detected', 'Mutation Detected', '🔴', '#ef4444', 'Apostas fechadas como red', 5);

-- ============ BOOKMAKERS ============
CREATE TABLE public.bookmakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmakers TO authenticated;
GRANT ALL ON public.bookmakers TO service_role;
ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmakers readable" ON public.bookmakers FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors manage bookmakers" ON public.bookmakers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "editors update bookmakers" ON public.bookmakers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "admin delete bookmakers" ON public.bookmakers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.bookmakers (name) VALUES ('BetLabel'), ('Betano'), ('Bet365'), ('Betclic');

-- ============ BETS ============
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id),
  bet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bet_time TIME NOT NULL DEFAULT CURRENT_TIME,
  competition TEXT,
  match TEXT NOT NULL,
  teams TEXT,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  player TEXT,
  odd NUMERIC(10,3) NOT NULL,
  stake NUMERIC(10,2) NOT NULL,
  target_units NUMERIC(10,2),
  target_profit NUMERIC(10,2),
  confidence SMALLINT CHECK (confidence BETWEEN 1 AND 5),
  bet_code TEXT,
  bookmaker_id UUID REFERENCES public.bookmakers(id),
  betlabel_link TEXT,
  status bet_status NOT NULL DEFAULT 'pending',
  result TEXT,
  profit_loss NUMERIC(10,2),
  notes TEXT,
  telegram_text TEXT,
  -- Infection Alert fields
  match_minute INT,
  alert_type TEXT,
  score_at_entry TEXT,
  -- Mutation Detected
  red_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets readable" ON public.bets FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert bets" ON public.bets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "editors update bets" ON public.bets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "admin delete bets" ON public.bets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_bets_status ON public.bets(status);
CREATE INDEX idx_bets_date ON public.bets(bet_date DESC);
CREATE INDEX idx_bets_service ON public.bets(service_id);

-- ============ BANKROLL ============
CREATE TABLE public.bankroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initial_amount NUMERIC(12,2) NOT NULL DEFAULT 1000,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE
);
GRANT SELECT, UPDATE ON public.bankroll TO authenticated;
GRANT ALL ON public.bankroll TO service_role;
ALTER TABLE public.bankroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bankroll readable" ON public.bankroll FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update bankroll" ON public.bankroll FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.bankroll (initial_amount, current_amount) VALUES (1000, 1000);

-- ============ BANKROLL MOVEMENTS ============
CREATE TABLE public.bankroll_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bankroll_movements TO authenticated;
GRANT ALL ON public.bankroll_movements TO service_role;
ALTER TABLE public.bankroll_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements readable" ON public.bankroll_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert movements" ON public.bankroll_movements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- ============ TELEGRAM TEMPLATES ============
CREATE TABLE public.telegram_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_templates TO authenticated;
GRANT ALL ON public.telegram_templates TO service_role;
ALTER TABLE public.telegram_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable" ON public.telegram_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage templates" ON public.telegram_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.telegram_templates (service_code, template_text) VALUES
('meisters_pick', E'🎩 MEISTER''S PICK\n\n🏆 Competição: {competition}\n⚽ Jogo: {match}\n🎯 Mercado: {market}\n📈 Aposta: {selection}\n🎲 Odd: {odd}\n💰 Stake: {stake}\n💀 Confiança: {confidence}/5\n\n🎫 Código da aposta:\n{bet_code}\n\n⚡ Copiar automaticamente na BetLabel:\n{betlabel_link}\n\n☣️ Que a infeção esteja connosco.'),
('greenite_detected', E'🦠 GREENITE DETECTED\n\n🏆 Competição: {competition}\n⚽ Jogo: {match}\n🎯 Mercado: {market}\n📈 Aposta: {selection}\n🎲 Odd: {odd}\n💰 Stake: {stake}\n💀 Confiança: {confidence}/5\n\n🎫 Código da aposta:\n{bet_code}\n\n⚡ Copiar automaticamente na BetLabel:\n{betlabel_link}\n\n☣️ Que a infeção esteja connosco.'),
('infection_alert', E'☣️ INFECTION ALERT\n\n⚽ Jogo: {match}\n⏱️ Minuto: {match_minute}\n🚨 Alerta: {alert_type}\n🎯 Mercado: {market}\n📈 Aposta: {selection}\n🎲 Odd: {odd}\n💰 Stake: {stake}\n💀 Confiança: {confidence}/5\n\n☣️ Que a infeção esteja connosco.'),
('greenite_spread', E'🟢 GREENITE SPREAD\n\n✅ GREEN CONFIRMADO\n⚽ Jogo: {match}\n📈 Aposta: {selection}\n🎲 Odd: {odd}\n💰 Lucro: {profit_loss}\n\n☣️ A infeção continua a espalhar-se.'),
('mutation_detected', E'🔴 MUTATION DETECTED\n\n❌ RED\n⚽ Jogo: {match}\n📈 Aposta: {selection}\n🎲 Odd: {odd}\n📉 Resultado: {result}\n🧬 Análise: {red_reason}\n\n☣️ Nem toda a infeção sobrevive. Seguimos.');

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.settings (key, value) VALUES
  ('unit_1', '50'::jsonb),
  ('unit_2', '100'::jsonb),
  ('default_betlabel_link', '""'::jsonb),
  ('telegram_channel', '"@greenite"'::jsonb),
  ('closing_phrase', '"☣️ Que a infeção esteja connosco."'::jsonb);

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ FUNCTIONS & TRIGGERS ============

-- updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bets_updated BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.telegram_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user: create profile + role (first user=admin, rest=viewer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bet closure: update bankroll + movement + audit
CREATE OR REPLACE FUNCTION public.handle_bet_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    UPDATE public.bankroll SET current_amount = current_amount + delta, updated_at = now() WHERE singleton = true RETURNING current_amount INTO new_balance;
    INSERT INTO public.bankroll_movements (bet_id, amount, type, description, balance_after)
      VALUES (NEW.id, delta, NEW.status::text, NEW.match || ' - ' || NEW.selection, new_balance);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_bet_change BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.handle_bet_change();

-- Audit log for bets
CREATE OR REPLACE FUNCTION public.log_bet_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
END; $$;

CREATE TRIGGER trg_bet_audit AFTER INSERT OR UPDATE OR DELETE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.log_bet_audit();
