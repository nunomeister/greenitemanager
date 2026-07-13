// Envia o print do resultado de uma aposta (e um sticker aleatório) para o canal do Telegram.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
const STICKERS_GREEN = Deno.env.get('TELEGRAM_STICKERS_GREEN');
const STICKERS_RED = Deno.env.get('TELEGRAM_STICKERS_RED');

function pickRandom(list?: string | null): string | null {
  if (!list) return null;
  const ids = list.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ error: 'Telegram não configurado (faltam secrets)' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { imageBase64, caption, status } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 em falta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Converte o base64 em bytes para anexar como ficheiro no multipart/form-data
    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const photoForm = new FormData();
    photoForm.append('chat_id', CHAT_ID);
    if (caption) photoForm.append('caption', caption.slice(0, 1024));
    photoForm.append('photo', new Blob([bytes], { type: 'image/png' }), 'result.png');

    const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: photoForm,
    });
    const photoData = await photoRes.json();

    if (!photoRes.ok || !photoData.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao enviar foto', detail: photoData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sticker (best-effort — se falhar, não invalida o envio da foto que já foi feito)
    let stickerOk = false;
    let stickerError: string | null = null;
    const stickerId = status === 'green' ? pickRandom(STICKERS_GREEN) : status === 'red' ? pickRandom(STICKERS_RED) : null;
    if (stickerId) {
      try {
        const stickerRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendSticker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, sticker: stickerId }),
        });
        const stickerData = await stickerRes.json();
        stickerOk = stickerRes.ok && stickerData.ok;
        if (!stickerOk) stickerError = JSON.stringify(stickerData);
      } catch (e: any) {
        stickerError = e?.message ?? 'erro desconhecido';
      }
    }

    return new Response(JSON.stringify({ ok: true, photo: true, sticker: stickerOk, stickerError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
