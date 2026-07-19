# DUELO BR / DUELO USA — project source of truth

A 2D political-parody fighting game. **Everything lives in one file: `index.html`**
(one IIFE, Canvas 2D 960×540, WebAudio, zero build step). Deployed via GitHub
Pages from `main`; custom domain `www.duelobr.com` (see `CNAME`).

> Content policy: **archetypes only — no real public-figure names anywhere.**
> Jokes are symmetric and good-natured so both sides enjoy them.

## Regions (multi-region engine)

The game ships two regions today: **BR** (Brasil) and **US** (USA). Region is
auto-detected from the browser and switchable via the corner flag button.

- `REGIONS` registry — each has `{ id, flag, label, ready, duo }`.
- `detectRegion()` — `localStorage.bb_region` → `navigator.language` / `Intl`
  timezone → fallback `br`.
- `currentRegion` — the active region; seeds the default `matchup` from
  `REGIONS[r].duo`.
- `applyRegion()` — the single wiring hook. Sets `body[data-region]`
  (drives CSS row visibility), translates the static menu/select/modal DOM
  via `L()`, refreshes premium cards + select portraits, sets the corner flag.
- `setRegion(id)` — persists `bb_region`, resets the founding duo, kicks off
  that region's sprite downloads, calls `applyRegion()`.

### Localized strings — `L(key, ...args)`

`TXT` is a flat map of `key: [pt, en]`. `L()` returns the string for
`currentRegion` (`us` → English, else Portuguese) and fills `{0}`,`{1}` args.
All player-facing flow strings route through it: title, menu, select, HUD,
round/match banners, matchEnd, celebration, tutorial, touch labels, pause,
and the online + unlock modals. Region-swapped CSS bits use `body[data-region="us"]`
(e.g. the touch `ATTACK` label).

## Roster

`FIGHTERS_BY_KEY` is the single registry (select screen + match setup read it).

| Region | Free duo            | Premium (R$1 / $1, 30-day)                    |
|--------|---------------------|-----------------------------------------------|
| BR     | ze, capitao         | mimi, jana, leao, dudu                        |
| US     | hope, dealmaker     | advocate, madam, bebest, podium               |

- **Ladders:** `CAMPAIGN_LADDERS[key]` — arch-rival first, then the rest.
  Campaign is the DEFAULT local mode; wins auto-advance; each stage buffs the
  CPU +10% (`applyCampaignBuff`).
- **Win quotes:** `WIN_QUOTES_BY_KEY[key]` (rotated, no repeats).
- **Entitlements:** `bb_premium` v2 `{v:2, exp:{key|"*":epochMs}, source, at}`,
  30-day TTL. Beta codes are SHA-256-matched (`UNLOCK_CODES`): `DUELOBETA` /
  `FAIXAVERDE` (all), plus per-fighter `MIMI2026`…`DUDU2026`,
  `ADVOCATE2026`/`MADAM2026`/`BEBEST2026`/`PODIUM2026`.
- **Payment backend** (`backend/`, OFF by default): set `PAY_API` +
  `PAY_ANON_KEY` in `index.html` to enable Pix. See `backend/README.md`.
  The "money" Supabase project is trading-related — DO NOT use it for the game.

## Sprites

Fighters are packed **strips**: a single row of uniform `cw×ch` cells,
feet bottom-aligned. `drawSprite(SPR, f, t)` picks a frame via the anim map
and scales by `scalePx / ch` (so every frame renders `scalePx` tall with feet
on the ground line). Per-sprite: `scalePx`, `contentRatio`, `koLying`.

**US strips use one 18-frame layout** (`usAnims()`):

```
0 idle · 1-3 walk · 4/5 punch S/A · 6/7 kick S/A ·
8-10 special S/A/R · 11 block · 12/13 hurt · 14 ko(lying) · 15-17 victory
```

- BR premium (`PREMIUM_SPRITES`) + US (`US_SPRITES`) merge into
  `SPRITES_BY_KEY`. `ensurePremiumSprites()` lazy-loads the current region's
  strips when the select screen opens; `ensureSpriteFor(key)` also fires at
  match start so an opponent picked outside the select screen (online / ladder)
  is loaded too.
- Registered US dims: hope 232×204, dealmaker 219×203, **advocate 295×346**,
  madam 182×192, bebest 266×273, podium 169×233 (all `scalePx` ≈ 148–154).

### Sprite pipeline (offline, in `scratchpad/`)

`raw_sheets/<region>/*.png` (artist sheets) → segmentation → **`pack_us2.mjs`**
→ `sprites/<region>/*.png` strips. `pack_us2.mjs` does: modal-grid /
palette bg keying (hue-gated so pale suits near the bg survive), optional
`strokeKill` (removes panel-border strokes), connected-component cleanup,
per-frame tighten, bottom-center pack at 0.5× with edge-only hue-matched
defringe. Per-pick options: cell index | manual `{x,y,w,h}` rect |
`{cell, shave*, zoom, erase}`.

> **Per-frame `zoom` normalization** — some source sheets draw certain poses
> at a smaller scale than the standing poses (advocate's victory/action frames
> were ~1.4–1.8× small). Apply `zoom` on those picks so every frame renders the
> figure at a consistent size. Verify with the in-game-scale grid
> (`scratchpad/ingame_frames.mjs`) — red box = cel-buffer bounds, green line =
> ground; every frame's feet must sit on the green line at a consistent size.

## Celebration / sash

During `phase === "celebrate"`, `spriteAnimFor` returns the `victory` anim for
the winner. `drawPremiumCelebration` / `drawZeCelebration` /
`drawDrawCelebration` render the winner(s) straight to the main canvas
(`drawFighterByKey` dispatches by spec key). The match champion wears a
**region-flag sash** (BR green+yellow, US red+white/blue rosette) drawn in
`drawSprite` when `f.wearSash` is set.

## Netcode (online)

Deterministic **lockstep** over PeerJS WebRTC. `NET_INPUT_DELAY=4`; each side
schedules `{t,keys}` for tick N+delay; the engine only advances a tick once
both sides' inputs are queued (`NET_PHASES` gate in `frame()`). Room codes are
4 digits; PeerJS IDs are prefixed `duelobr-v2-`; random matchmaking uses slots
`duelobr-v2-mm-0..7`. Any fighter on both sides, mirrors allowed.
**Untestable in the sandbox** (PeerJS broker unreachable) — validate on 2 phones.

## Deploy flow

1. Develop on the dev branch `claude/batalha-brasil-sash-visual-4qcing`.
2. Validate: `node scratchpad/check.mjs` (inline-JS syntax + zero page errors),
   Playwright screenshots for BR **and** US (region auto-detects US under an
   en-US locale headless browser; force with `localStorage.bb_region`).
3. Fast-forward `main` **only with owner approval**, push.
4. Verify: `raw.githubusercontent.com/.../main/index.html` sha == local, and
   the "pages build and deployment" Actions run for the pushed SHA is
   `completed / success` (via GitHub MCP `actions_list`).

## Sandbox limits

`duelobr.com` / `github.io` blocked by the proxy (403); PeerJS broker
unreachable (online untestable); anonymous GitHub API rate-limited (use MCP);
`raw.githubusercontent.com` works. Playwright ships at
`/opt/node22/lib/node_modules/playwright`.
