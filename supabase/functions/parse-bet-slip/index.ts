// Parse a BetLabel bet slip screenshot or history HTML into structured bet data.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_SLIP = `You extract sports bet data from BetLabel (Portuguese bookmaker) betslip screenshots.
Return ONE JSON object with these keys (use null when unknown):
  match (string, e.g. "Benfica vs Porto"),
  competition (string),
  market (string, e.g. "Mais/Menos Golos"),
  selection (string, e.g. "Mais de 2.5"),
  player (string or null),
  odd (number),
  stake (number, in EUR),
  bet_date (YYYY-MM-DD or null),
  bet_time (HH:MM or null),
  bet_code (string or null),
  bookmaker (string, default "BetLabel").
Output ONLY the JSON object, no prose.`;

const SYSTEM_HISTORY = `You extract ALL bets from a BetLabel history HTML page.
Return a JSON object: { "bets": [ ...bet objects... ] }.
Each bet object must have:
  match, competition, market, selection, player, odd (number), stake (number),
  bet_date (YYYY-MM-DD), bet_time (HH:MM or null),
  bet_code, bookmaker (default "BetLabel"),
  status ("pending" | "green" | "red" | "void"),
  profit_loss (number, positive on green, negative on red, 0 otherwise, or null),
  result (string or null, e.g. "1-0").
Use null when a field is unknown. Output ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { mode, image, html } = await req.json();
    if (!['slip', 'history'].includes(mode)) {
      return new Response(JSON.stringify({ error: 'invalid mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let messages: any[];
    if (mode === 'slip') {
      if (!image || typeof image !== 'string') {
        return new Response(JSON.stringify({ error: 'image (data URL) required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      messages = [
        { role: 'system', content: SYSTEM_SLIP },
        { role: 'user', content: [
          { type: 'text', text: 'Extract this betslip.' },
          { type: 'image_url', image_url: { url: image } },
        ]},
      ];
    } else {
      if (!html || typeof html !== 'string') {
        return new Response(JSON.stringify({ error: 'html required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Strip <script>/<style> and cap size
      const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .slice(0, 180000);
      messages = [
        { role: 'system', content: SYSTEM_HISTORY },
        { role: 'user', content: `Extract every bet from this BetLabel history HTML:\n\n${cleaned}` },
      ];
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      const status = aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: 'AI error', detail: text.slice(0, 500) }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch { parsed = { error: 'AI returned non-JSON', raw: content }; }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
