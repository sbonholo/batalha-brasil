// DUELO BR — payment Edge Function (Supabase / Deno).
// One function, four actions (?action=):
//   create       POST {device, fighter}  -> creates a R$1 Pix payment, returns QR
//   status       GET  ?order=<id>         -> order status (client polls this)
//   entitlements GET  ?device=<id>        -> active (non-expired) unlocks for a device
//   webhook      POST (Mercado Pago)      -> on approved payment, grant 30-day unlock
//
// Deploy with verify_jwt = FALSE (the MP webhook can't send a Supabase JWT;
// the function does its own validation by re-fetching the payment from MP).
//
// Required env (set in the Supabase dashboard → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN            your Mercado Pago access token (production)
//   SUPABASE_URL               (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-provided)
// Optional:
//   ALLOWED_ORIGIN             CORS origin, defaults to https://www.duelobr.com

import { createClient } from "jsr:@supabase/supabase-js@2";

const PREMIUM = new Set(["mimi", "jana", "leao", "dudu"]);
const PRICE_BRL = 1;
const TTL_DAYS = 30;
const MP = "https://api.mercadopago.com";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://www.duelobr.com";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const mpToken = () => Deno.env.get("MP_ACCESS_TOKEN") ?? "";

async function activeEntitlements(device: string) {
  const { data } = await db
    .from("game_entitlements")
    .select("fighter_key, expires_at")
    .eq("device_id", device)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []).map((r) => ({ key: r.fighter_key, exp: r.expires_at }));
}

async function grant(device: string, fighter: string) {
  const expires = new Date(Date.now() + TTL_DAYS * 864e5).toISOString();
  await db.from("game_entitlements").upsert(
    { device_id: device, fighter_key: fighter, expires_at: expires, source: "purchase" },
    { onConflict: "device_id,fighter_key" },
  );
  return expires;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ---- create a Pix payment ----
    if (action === "create" && req.method === "POST") {
      const { device, fighter } = await req.json();
      if (!device || !PREMIUM.has(fighter)) return json({ error: "bad_request" }, 400);
      if (!mpToken()) return json({ error: "backend_not_configured" }, 503);

      const { data: order } = await db
        .from("game_orders")
        .insert({ device_id: device, fighter_key: fighter, amount: PRICE_BRL })
        .select("id").single();

      const pay = await fetch(`${MP}/v1/payments`, {
        method: "POST",
        headers: {
          "authorization": `Bearer ${mpToken()}`,
          "content-type": "application/json",
          "x-idempotency-key": order!.id,
        },
        body: JSON.stringify({
          transaction_amount: PRICE_BRL,
          description: `DUELO BR — desbloquear ${fighter}`,
          payment_method_id: "pix",
          external_reference: order!.id,
          payer: { email: `dev_${device.slice(0, 12)}@duelobr.com` },
        }),
      }).then((r) => r.json());

      if (!pay?.id) return json({ error: "mp_error", detail: pay }, 502);
      await db.from("game_orders").update({ mp_payment_id: String(pay.id) }).eq("id", order!.id);

      const tx = pay.point_of_interaction?.transaction_data ?? {};
      return json({
        orderId: order!.id,
        qr: tx.qr_code ?? null,             // Pix copia-e-cola string
        qrBase64: tx.qr_code_base64 ?? null, // PNG (base64) of the QR
        ticketUrl: tx.ticket_url ?? null,
      });
    }

    // ---- poll order status ----
    if (action === "status" && req.method === "GET") {
      const id = url.searchParams.get("order");
      if (!id) return json({ error: "bad_request" }, 400);
      const { data: o } = await db
        .from("game_orders").select("status, fighter_key, device_id").eq("id", id).single();
      if (!o) return json({ error: "not_found" }, 404);
      return json({
        status: o.status,
        entitlements: o.status === "paid" ? await activeEntitlements(o.device_id) : [],
      });
    }

    // ---- list active entitlements for a device ----
    if (action === "entitlements" && req.method === "GET") {
      const device = url.searchParams.get("device");
      if (!device) return json({ error: "bad_request" }, 400);
      return json({ entitlements: await activeEntitlements(device) });
    }

    // ---- Mercado Pago webhook ----
    if (action === "webhook" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const paymentId = body?.data?.id ?? url.searchParams.get("data.id");
      if (!paymentId) return json({ ok: true }); // ignore non-payment pings

      // Re-fetch the payment from MP (never trust the webhook body alone)
      const pay = await fetch(`${MP}/v1/payments/${paymentId}`, {
        headers: { "authorization": `Bearer ${mpToken()}` },
      }).then((r) => r.json());

      const orderId = pay?.external_reference;
      if (pay?.status === "approved" && orderId) {
        const { data: o } = await db
          .from("game_orders").select("device_id, fighter_key, status").eq("id", orderId).single();
        if (o && o.status !== "paid") {
          await grant(o.device_id, o.fighter_key);
          await db.from("game_orders")
            .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
        }
      }
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 404);
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
