
# Greenite Manager — Plano de Implementação

Aplicação privada de gestão de prognósticos da Greenite. Vou implementar primeiro o **MVP** (login, apostas, dashboard, banca, templates Telegram) com uma base sólida e escalável, para depois adicionar estatísticas avançadas, exportações e gestão completa de utilizadores.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend**: Lovable Cloud (Supabase gerido) — auth, base de dados, RLS, edge functions
- **Gráficos**: recharts
- **Tema**: dark mode fixo, preto + verde neon + cinzento, estética "vírus/infeção"

## Antes de começar — 2 perguntas rápidas

1. **Registo por convite**: no MVP, prefere que eu crie **apenas o Admin através de signup normal** e o Admin depois convida os restantes por email, OU quer já o fluxo completo de convites com tokens? (Recomendo opção 1 para o MVP.)
2. **Recuperação de password**: OK usar o email padrão do Lovable Cloud (link de reset por email)?

Assumo **sim** para ambos se não responder — avança tudo.

## MVP — Fase 1 (esta entrega)

### Design System
- `index.css` e `tailwind.config.ts` com tokens semânticos: fundo preto (`#0a0f0a`), verde neon (`#39ff14`), cinzentos, vermelho tóxico, âmbar. Gradientes `--gradient-toxic`, sombras `--shadow-neon`, fonte display estilo tech (JetBrains Mono / Space Grotesk).
- Cada serviço com cor/ícone próprio: 🎩 dourado, 🦠 verde neon, ☣️ âmbar, 🟢 verde, 🔴 vermelho tóxico.

### Base de Dados (Lovable Cloud)

Tabelas criadas no MVP (com RLS + GRANTs):

- `profiles` (id, display_name, avatar_url, created_at)
- `user_roles` (id, user_id, role enum: admin/editor/viewer) — tabela separada + função `has_role()` security definer
- `services` (id, code, name, emoji, color, active) — seed com os 5 serviços
- `bookmakers` (id, name, active)
- `bets` — todos os campos pedidos: date, time, competition, match, teams, market, selection, player, odd, stake, target_units, target_profit, confidence, bet_code, bookmaker_id, betlabel_link, service_id, status (pending/green/red/void/cashout), result, profit_loss, notes, telegram_text, created_by, minute, alert_type, score_at_entry, red_reason
- `bankroll` (id, initial_amount, current_amount, updated_at) — single row
- `bankroll_movements` (id, bet_id, amount, type, created_at)
- `settings` (chave/valor) — unit_1, unit_2, default_betlabel_link, telegram_channel, closing_phrases
- `telegram_templates` (id, service_code, template_text) — seed com os 5 templates
- `audit_log` (id, user_id, action, entity, entity_id, changes jsonb, created_at)

Trigger automático: ao criar user cria `profile` + role default `viewer`. Primeiro user registado recebe `admin`. Trigger em `bets` atualiza `bankroll` e `bankroll_movements` quando status muda para green/red/void/cashout, e grava `audit_log`.

### Páginas MVP

```text
/auth              Login + signup + reset password
/                  Dashboard (protegido)
/bets/new          Nova aposta (admin/editor)
/bets/pending      Apostas pendentes
/bets/results      Resultados (tabela + filtros básicos)
/bankroll          Banca Greenite
/templates         Templates Telegram (visualizar + copiar)
/settings          Definições (admin)
```

Layout: sidebar fixa com identidade Greenite, header com utilizador/role, área principal responsiva.

### Funcionalidades MVP

- **Auth**: login, signup, reset password, logout, guarda de rotas por role.
- **Dashboard**: cards grandes com Lucro total/diário/semanal/mensal, ROI, taxa de acerto, contadores (greens/reds/voids/pending), lucro por serviço, melhor/pior serviço, gráfico evolução da banca (linha), gráfico resultados por dia (barras), gráfico lucro por serviço (barras).
- **Nova Aposta**: formulário completo com todos os campos, seletor de serviço com identidade visual, **calculadora automática de stake** a partir de lucro alvo e odd (`stake = alvo / (odd - 1)`), presets 1u=50€ / 2u=100€ / personalizado, campos condicionais para Infection Alert (minuto, tipo de alerta, score).
- **Apostas Pendentes**: cards com ações — editar, duplicar, marcar green/red/void/cashout, gerar texto Telegram, botão copiar. Ao fechar, pede lucro/resultado e atualiza banca automaticamente.
- **Resultados**: tabela com filtros por data, serviço, estado, competição, mercado, casa, odd, lucro.
- **Banca**: banca inicial, atual, lucro acumulado, exposição pendente, unidades, ROI, drawdown máx, melhor sequência green, pior sequência red, histórico de movimentos.
- **Templates Telegram**: preview dos 5 templates com placeholders reais das apostas, botão copiar. Gerador automático ao criar/fechar aposta.
- **Definições (admin)**: valor 1u/2u, link BetLabel padrão, canal Telegram, casas de apostas, serviços ativos, frases finais, banca inicial, gestão de roles dos utilizadores.

### Permissões (RLS)

- Viewer: SELECT em tudo, sem UPDATE/INSERT/DELETE.
- Editor: INSERT/UPDATE bets, atualizar resultados; sem tocar em `settings`, `bankroll.initial_amount`, `user_roles`.
- Admin: acesso total.

### Auditoria
Trigger `audit_log` em bets (INSERT/UPDATE/DELETE) e em `settings`, `bankroll`, `user_roles`.

## Fase 2 — Após MVP validado

- Página de **Estatísticas** avançadas (por competição/jogador/mercado/utilizador/mês/odd range com todos os KPIs).
- **Exportações**: CSV, Excel (xlsx), PDF (relatório diário/semanal/mensal via edge function).
- **Convites por email** com tokens (se não já feito no MVP).
- Envio direto para Telegram via Bot API (connector).
- Notificações, filtros avançados persistentes, atalhos móveis.

## Detalhes técnicos

- Ativação de **Lovable Cloud** primeiro (auth + DB).
- Migração SQL única para todas as tabelas com GRANTs + RLS + policies + triggers + seeds dos 5 serviços e 5 templates.
- Função `has_role(uuid, app_role)` security definer para evitar recursão RLS.
- Cliente Supabase em `src/integrations/supabase/client.ts` (auto-gerado).
- Hook `useAuth` + `useRole` + `ProtectedRoute` wrapper.
- Componentes reutilizáveis: `BetCard`, `ServiceBadge`, `StatCard`, `StakeCalculator`, `TelegramPreview`.

## Diagrama de rotas

```text
App
├── /auth (público)
└── ProtectedRoute
    ├── /               Dashboard
    ├── /bets/new       (editor+)
    ├── /bets/pending
    ├── /bets/results
    ├── /bankroll
    ├── /templates
    └── /settings       (admin)
```

Confirma as 2 perguntas acima (ou diz "avança") e começo pela ativação da Cloud + migração + design system + auth.
