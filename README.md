# Flight Planner Prototype

Stateless natural-language flight itinerary assistant built with Next.js, TypeScript, a shadcn-style component layer, the OpenAI API, and an Amadeus flight-search adapter.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Review `.env.local` and replace the stub values when you have real keys.

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Deploy to Vercel

Use the deploy script from the repo root:

```bash
npm run deploy:vercel
```

For a production deploy:

```bash
npm run deploy:vercel -- --prod
```

The script runs `lint` and `build` first, then calls the Vercel CLI. You still need to add these environment variables in the Vercel project settings:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`

## How it works

- The browser stores the live chat state and the current `TravelPlan`.
- Reloading the page clears everything.
- `POST /api/turn` decides whether to ask a clarification question or search flights.
- If API keys are missing, the app falls back to deterministic mock flight results so the interface still works.

## Environment variables

See `.env.example` for the required keys:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`
