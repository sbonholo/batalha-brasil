# DUELO BR — payment backend (setup runbook)

Unlocks paid fighters (R$ 1 each, 30-day access) via **Mercado Pago Pix**.
The static game talks to one Supabase Edge Function; the DB is the source of
truth so a client can never grant itself a fighter.

```
client (index.html)                Supabase Edge Function        Mercado Pago
  COMPRAR ──create──▶  duelobr-pay ?action=create ──────────▶  create Pix payment
  show QR / copia-e-cola  ◀───────────── {qr, orderId} ────────────┘
  (user pays Pix) ─────────────────────────────────────────────▶  approved
                        duelobr-pay ?action=webhook  ◀──── MP notifies
                          verify + grant 30d entitlement
  poll ?action=status ─▶ status:paid + entitlements ─▶ unlock + cache locally
```

## One-time setup (what only you can do)

1. **Pick a Supabase project** (the `money` one is a trading project — use a
   dedicated one; create a new project if needed).

2. **Apply the schema** — run `backend/schema.sql` on that project
   (SQL editor, or `supabase db` / the apply_migration tool).

3. **Deploy the function** `duelobr-pay` from `backend/duelobr-pay/index.ts`
   with **verify_jwt = false** (the MP webhook can't send a Supabase JWT; the
   function re-fetches each payment from MP to validate).

4. **Set the function secret** (Dashboard → Edge Functions → Secrets):
   - `MP_ACCESS_TOKEN` = your Mercado Pago **production** access token
     (Mercado Pago → Suas integrações → Credenciais de produção).
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
   - optional `ALLOWED_ORIGIN` (defaults to `https://www.duelobr.com`).

5. **Point the Mercado Pago webhook** at
   `https://<project-ref>.supabase.co/functions/v1/duelobr-pay?action=webhook`
   (Mercado Pago → Webhooks, event: *payments*).

6. **Wire the client**: set `PAY_API` in `index.html` to
   `https://<project-ref>.supabase.co/functions/v1/duelobr-pay` and set
   `PAY_ANON_KEY` to the project's publishable/anon key. Until `PAY_API` is
   set, the COMPRAR button stays in the honest "em breve" state and only the
   beta codes unlock.

## Notes
- Entitlements are keyed by a random per-device id stored in the browser, and
  cached in `localStorage` with the 30-day expiry so play works offline; the
  client re-syncs from the server when online.
- For R$ 1 this trades a little shareability (a device id could be copied) for
  zero-friction, no-login purchase. Add device-count limits later if needed.
- Refund/replace = delete the `game_entitlements` row (or shorten `expires_at`).
