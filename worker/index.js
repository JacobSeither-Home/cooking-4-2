/**
 * Cooking 4 2 — Cloudflare Worker
 *
 * Routes:
 *   GET /recipe?url=<url>          Parse a recipe page → JSON
 *   GET /search?q=<q>&sites=<...>  Search across approved sites → JSON[]
 *   GET /debug                     Verify secrets + raw Google API response
 *
 * Secrets (set via: npx wrangler secret put <NAME>):
 *   GOOGLE_API_KEY   — Google Cloud API key with Custom Search API enabled
 *   GOOGLE_SEARCH_CX — Programmable Search Engine ID
 *
 * Deploy:
 *   cd worker && npm install && npx wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url      = new URL(request.url)
    const pathname = url.pathname

    try {
      if (pathname === '/recipe') {
        return handleRecipe(url.searchParams.get('url'))
      }
      if (pathname === '/search') {
        return handleSearch(
          url.searchParams.get('q'),
          url.searchParams.get('sites'),
          env,
        )
      }
      if (pathname === '/debug') {
        return handleDebug(env)
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message }, 500)
    }
  },
}

// ── /debug ────────────────────────────────────────────────────────────────────
async function handleDebug(env) {
  const key = env.GOOGLE_API_KEY || ''
  const cx  = env.GOOGLE_SEARCH_CX || ''

  const keyInfo = key
    ? `set (length=${key.length}, starts=${key.slice(0,8)}..., ends=...${key.slice(-4)})`
    : 'NOT SET'
  const cxInfo = cx || 'NOT SET'

  // Make a real test call
  const params = new URLSearchParams({ key, cx, q: 'pasta', num: '1' })
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
  const body = await res.json().catch(() => ({}))

  return json({
    keyInfo,
    cx: cxInfo,
    googleStatus: res.status,
    googleResponse: body,
  })
}

// ── /recipe ───────────────────────────────────────────────────────────────────
async function handleRecipe(targetUrl) {
  if (!targetUrl) return json({ error: 'url param required' }, 400)

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Cooking42Bot/1.0)',
      'Accept':     'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) return json({ error: `Upstream returned ${res.status}` }, 502)

  const html = await res.text()

  const recipe = extractJsonLd(html) || extractMicrodata(html) || extractFallback(html, targetUrl)

  if (!recipe) return json({ error: 'Could not parse recipe from this page.' }, 422)

  recipe.sourceUrl  = targetUrl
  recipe.sourceSite = new URL(targetUrl).hostname.replace(/^www\./, '')

  return json(recipe)
}

function extractJsonLd(html) {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1].trim())
      const candidates = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data]
      for (const item of candidates) {
        if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
          return normalizeJsonLdRecipe(item)
        }
      }
    } catch {}
  }
  return null
}

function normalizeJsonLdRecipe(r) {
  return {
    title:       r.name || '',
    description: r.description || '',
    image:       getImage(r.image),
    ingredients: (r.recipeIngredient || []).map(parseIngredient),
    steps:       extractSteps(r.recipeInstructions),
    prepTime:    parseDuration(r.prepTime),
    cookTime:    parseDuration(r.cookTime),
    servings:    parseServings(r.recipeYield),
    rating:      r.aggregateRating?.ratingValue ? parseFloat(r.aggregateRating.ratingValue) : 0,
    genre:       [r.recipeCategory, r.recipeCuisine].flat().filter(Boolean),
    keywords:    r.keywords ? String(r.keywords).split(',').map(s => s.trim()) : [],
  }
}

function extractMicrodata(html) {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
  const desc  = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
  const image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
  if (!title) return null
  return { title, description: desc || '', image: image || '', ingredients: [], steps: [], genre: [] }
}

function extractFallback(html, url) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split('|')[0]?.trim()
  if (!title) return null
  return { title, description: '', image: '', ingredients: [], steps: [], genre: [] }
}

// ── /search — uses Google Custom Search JSON API ──────────────────────────────
async function handleSearch(query, sitesParam, env) {
  if (!query) return json({ error: 'q param required' }, 400)

  if (!env.GOOGLE_API_KEY || !env.GOOGLE_SEARCH_CX) {
    return json({ error: 'Search is not configured. Set GOOGLE_API_KEY and GOOGLE_SEARCH_CX secrets.' }, 500)
  }

  // The PSE (GOOGLE_SEARCH_CX) is already restricted to recipe sites,
  // so we pass the query directly. No site: operators needed.
  const params = new URLSearchParams({
    key: env.GOOGLE_API_KEY,
    cx:  env.GOOGLE_SEARCH_CX,
    q:   query,
    num: '10',
  })

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    return json({ error: errBody?.error?.message || `Search API returned ${res.status}` }, 502)
  }

  const data = await res.json()

  const results = (data.items || []).map(item => ({
    title:       item.title || '',
    url:         item.link  || '',
    description: item.snippet || '',
    image:       item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || '',
    site:        (() => { try { return new URL(item.link).hostname.replace(/^www\./, '') } catch { return '' } })(),
  }))

  return json(results)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getImage(img) {
  if (!img) return ''
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return img[0]?.url || img[0] || ''
  return img.url || ''
}

function parseDuration(iso) {
  if (!iso) return 0
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0)
}

function parseServings(yield_) {
  if (!yield_) return 0
  const n = parseInt(Array.isArray(yield_) ? yield_[0] : yield_)
  return isNaN(n) ? 0 : n
}

function parseIngredient(str) {
  const m = str.trim().match(/^([\d\s⁄\/]+)?\s*(cup|cups|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|bunch|bunches|piece|pieces|slice|slices|can|cans|pkg|package|inch|large|medium|small)s?\s+(.+)/i)
  if (m) return { quantity: (m[1] || '').trim(), unit: m[2], name: m[3].trim() }
  return { quantity: '', unit: '', name: str.trim() }
}

function extractSteps(instructions) {
  if (!instructions) return []
  if (typeof instructions === 'string') return [instructions]
  if (Array.isArray(instructions)) {
    return instructions.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (item['@type'] === 'HowToSection') return extractSteps(item.itemListElement)
      return [item.text || item.name || '']
    }).filter(Boolean)
  }
  return []
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
