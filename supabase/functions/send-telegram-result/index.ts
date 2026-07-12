// Send a bet result image to a Telegram channel.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return new Response(
        JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64: string | undefined = body?.imageBase64;
    const caption: string = typeof body?.caption === 'string' ? body.caption : '';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Strip data URL prefix if present.
    const cleaned = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/png' });

    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('photo', blob, 'result.png');
    if (caption) {
      form.append('caption', caption.slice(0, 1024));
      form.append('parse_mode', 'HTML');
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: form },
    );
    const tgJson = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || tgJson?.ok === false) {
      console.error('Telegram sendPhoto failed', tgRes.status, tgJson);
      return new Response(
        JSON.stringify({ error: 'Telegram API error', status: tgRes.status, details: tgJson }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message_id: tgJson?.result?.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-telegram-result error', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
