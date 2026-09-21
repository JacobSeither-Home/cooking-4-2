/**
 * Cooking 4 2 — Cloudflare Worker
 *
 * Routes:
 *   GET /recipe?url=<url>          Parse a recipe page → JSON
 *   GET /search?q=<q>&sites=<...>  Search across approved sites → JSON[]
 *
 * Deploy:
 *   cd worker && npm install && npx wrangler deploy
 *
 * Then set VITE_WORKER_URL in your GitHub Actions secrets to the deployed URL.
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
        )
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message }, 500)
    }
  },
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

  // 1. Try JSON-LD (most reliable — used by NYT, Serious Eats, AllRecipes, etc.)
  const recipe = extractJsonLd(html) || extractMicrodata(html) || extractFallback(html, targetUrl)

  if (!recipe) return json({ error: 'Could not parse recipe from this page.' }, 422)

  // Normalize and enrich
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
  // Very basic microdata fallback — grab OG title + description at minimum
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

// ── /search ───────────────────────────────────────────────────────────────────
async function handleSearch(query, sitesParam) {
  if (!query) return json({ error: 'q param required' }, 400)

  const domains = sitesParam ? sitesParam.split(',').map(s => s.trim()).filter(Boolean) : []
  if (domains.length === 0) return json([])

  // Build a Google search URL with site: operators
  const siteQuery = domains.map(d => `site:${d}`).join(' OR ')
  const fullQuery = `${query} recipe ${siteQuery}`
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}&num=20`

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!res.ok) return json([])

  const html = await res.text()
  const results = parseGoogleResults(html, domains)

  return json(results)
}

function parseGoogleResults(html, allowedDomains) {
  const results = []
  // Extract result blocks — Google's HTML structure for organic results
  const blocks = html.matchAll(/<div[^>]*class="[^"]*g[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*g[^"]*"|$)/g)

  for (const block of blocks) {
    try {
      const content = block[1]
      const href    = content.match(/href="(https?:\/\/[^"]+)"/)?.[1]
      if (!href) continue

      const domain = new URL(href).hostname.replace(/^www\./, '')
      if (!allowedDomains.some(d => href.includes(d))) continue

      const title = content.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1]?.trim()
      if (!title) continue

      const desc = content.match(/<span[^>]*>([^<]{30,200})<\/span>/)?.[1]?.trim()
      const img  = content.match(/src="([^"]+)"[^>]*>/)?.[1]

      results.push({ title, url: href, description: desc || '', image: img || '', site: domain })
      if (results.length >= 12) break
    } catch {}
  }

  return results
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
  // Attempt to split "1 cup flour" → { quantity: '1', unit: 'cup', name: 'flour' }
  const m = str.trim().match(/^([\d\s⁄/]+)?\s*(cup|cups|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|bunch|bunches|piece|pieces|slice|slices|can|cans|pkg|package|inch|large|medium|small)s?\s+(.+)/i)
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
