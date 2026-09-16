# 5C Dining — 5C Dining Hall App (Expo SDK 57)

Dining hall menus for the Claremont Colleges, powered by
`https://five-c-menu-api.kainoanewton.workers.dev/v1/menus`.

## Run it

```sh
npm install
npm run web      # browser preview → http://localhost:8081
npm start        # phone via Expo Go (scan QR), press `w` for web
```

One-time npm cache fix (macOS root-owned cache):
```sh
sudo chown -R $(id -u):$(id -g) "/Users/knewton/.npm"
```

## App structure

```text
app/(tabs)/
  mcconnell.tsx  # MC — McConnell · Pitzer
  frary.tsx      # FY — Frary · Pomona
  hoch.tsx       # HC — Hoch-Shanahan · Harvey Mudd
  malott.tsx     # MA — Malott · Scripps
  collins.tsx    # CO — Collins · Claremont McKenna
  frank.tsx      # FK — Frank · Pomona
  oldenborg.tsx  # OL — Oldenborg · Pomona
  settings.tsx   # ⚙ default hall, dietary filters, display
  index.tsx      # redirects to default hall
lib/
  diningHalls.ts # static hall config (pages fixed, menu dynamic)
  api.ts         # GET /v1/menus/{hall}?date=YYYY-MM-DD + time formatting
  dates.ts       # Claremont-time week strip (Today + 7 days)
  settings.tsx   # prefs context, persisted with AsyncStorage
components/
  HallScreen.tsx # header + date strip + meal/station accordions
  DiningTabBar.tsx # rectangular bottom bar (7 halls + cog)
```

## UX decisions

- Hall pages are static routes; only date + menu come from the API.
- Date strip: Today / Tomorrow / weekday cards, two lines (label + M/D),
  horizontal scroll, today pinned left, 8 days total.
- First meal auto-expands; stations start collapsed with item + VG counts;
  Expand all / Collapse all per meal.
- Item rows show VG (vegan) / V (vegetarian) chips + calories; descriptions
  toggleable. Vegan-only / vegetarian-only filters live in Settings.
- Meals with `startTime`/`endTime` show e.g. "Dinner · 5:00 PM – 7:30 PM";
  Hoch (no times in API) falls back to station/item counts.
- Unavailable days (Oldenborg often) get a friendly empty state + retry.
- School badge: colored circle with initials (HM/SC/PZ/CM/PO), right-aligned.

## Checks

```sh
npm run typecheck
npm run lint
npm run export:web  # static build → dist/
```
