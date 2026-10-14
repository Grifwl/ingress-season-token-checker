# Ingress Season Token Checker

A web page that forecasts which Ingress season medal you will reach, and
what it takes to reach the next one. It runs at
[season.grifwl.blue](https://season.grifwl.blue), with one page per season
(for example [`/cygnus`](https://season.grifwl.blue/cygnus)).

## What it does

You enter:

- your current season tokens and how many daily bounties you did today;
- for every token source (First Saturdays, Shard Storms, Dispatch campaigns,
  global campaigns…), whether you already got its tokens, your progress, and
  whether you plan to take part in what is left.

The page then:

1. subtracts the event tokens you already earned from your total, to find
   how many tokens came from daily bounties;
2. turns that into your average pace per day;
3. projects your final total if you keep that pace and do the events you
   committed to;
4. for each medal tier you have not reached yet, tells you whether your pace
   is enough. If it is not, it tells you on how many days you need to do every
   daily bounty, and which in-person events you would need to attend.

Some token sources are only partially documented (for example a campaign
whose bounty breakdown is unpublished). The engine handles every uncertain
figure as a `[min, max]` range, so results show the worst and best cases.
They get narrower as the series config is refined.

Your answers are only stored in your own browser (`localStorage`).

## Adding a new series

Everything specific to a season lives in one config file:

1. Copy `src/series/cygnus.ts` to `src/series/<name>.ts` and update:
   - dates and medal thresholds (any number of tiers);
   - daily bounty rewards (`dailyBounties`);
   - the events and their token rewards. There are three kinds:
     - `fixed`: all-or-nothing, e.g. a First Saturday check-in;
     - `campaign`: Dispatch campaigns with a known assignment structure.
       Assignments can be *detailed* (bounties + reward + required count) or
       *opaque* (only the total is known);
     - `open`: only the maximum is known; agents enter what they earned.
2. Register it in `src/series/index.ts`.
3. Run `npm test`. It checks every config for consistency.

The series is then served at `/<id>`.

## Development

Requires Node.js 20 or later.

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # type-check and build into dist/
```

## Deployment

The site is a static build served by a Cloudflare Worker with static assets
(see `wrangler.jsonc`). It is bound to the custom domain
`season.grifwl.blue`.

```sh
npx wrangler login   # once
npm run deploy
```

## Project structure

```
src/
  series/      season configs and their types
  engine/      forecasting logic (no DOM; reusable, e.g. by a bot)
  ui/          page rendering, formatting and browser storage
  main.ts      router
tests/         unit tests of the engine and configs
```
