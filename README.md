# Flora of the Philippines — searchable database

A static, instantly-searchable web database of the ~10,900 vascular plant species of the
Philippines: taxonomy, citation/synonymy, distribution, conservation status, DAO category,
native/naturalized status, and photos.

Data is sourced from **[Co's Digital Flora of the Philippines](https://www.philippineplants.org/)**
(Pelser, Barcelona & Nickrent, eds., 2011 onwards). Photos are © their respective
contributors and are served from the Cornell University herbarium gallery; this is an
unofficial search interface.

## How it works

- **No database / no server.** All data is pre-generated into static JSON under `public/data/`
  and shipped with the site. Search and filtering run entirely in the browser, so it's fast
  and free to host.
  - `index.json` — one compact record per species (loaded once, ~1.2 MB) for live search.
  - `families/<slug>.json` — full detail for each family, lazy-loaded when you open a species.
  - `meta.json` — totals and filter option lists.
- The raw scrape lives in the sibling `../philippineplants_scraper/` folder.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Rebuilding the data

Run the scrapers in `../philippineplants_scraper/` first, then regenerate the site data:

```bash
npm run data       # reads ../philippineplants_scraper/output/{species,images}.json
npm run build      # production build
```

`npm run data` merges photo thumbnail URLs from `images.json` if it's present. Re-run it any
time the underlying flora data or the image scrape is updated.

## Deploy to Vercel

The `public/data/` files are committed, so Vercel only needs to run `next build` — no Python
and no scraping happen on Vercel.

**Option A — GitHub import (recommended):**
1. Push this folder to a new GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset auto-detects **Next.js**. Leave defaults. Click **Deploy**.

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel            # follow prompts; then `vercel --prod`
```

No environment variables are required.
