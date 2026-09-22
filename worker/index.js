/**
 * Cooking 4 2 — Cloudflare Worker
 *
 * Routes:
 *   GET /recipe?url=<url>          Parse a recipe page → structured JSON
 *   GET /search?q=<q>&sites=<...>  Search across sites by scraping each one directly
 *
 * No external API keys required for search.
 * Recipe import uses schema.org JSON-LD (present on ~90% of major recipe sites).
 *
 * Deploy:
 *   cd worker && npx wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Standard browser-like headers so sites don't block the Worker
const FETCH_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control':   'no-cache',
}

// ── Search URL patterns per domain ────────────────────────────────────────────
// These mirror the searchPath values in the app's DEFAULT_SITES.
const SITE_SEARCH = {
  'cooking.nytimes.com':      q => `https://cooking.nytimes.com/search?q=${enc(q)}`,
  'www.seriouseats.com':      q => `https://www.seriouseats.com/search?q=${enc(q)}`,
  'www.budgetbytes.com':      q => `https://www.budgetbytes.com/?s=${enc(q)}`,
  'www.halfbakedharvest.com': q => `https://www.halfbakedharvest.com/?s=${enc(q)}`,
  'smittenkitchen.com':       q => `https://smittenkitchen.com/?s=${enc(q)}`,
  'www.allrecipes.com':       q => `https://www.allrecipes.com/search?q=${enc(q)}`,
  'food52.com':               q => `https://food52.com/recipes/search?q=${enc(q)}`,
  'www.thekitchn.com':        q => `https://www.thekitchn.com/recipes?q=${enc(q)}`,
  'www.bonappetit.com':       q => `https://www.bonappetit.com/search?q=${enc(q)}`,
  'minimalistbaker.com':      q => `https://minimalistbaker.com/?s=${enc(q)}`,
}

function enc(s) { return encodeURIComponent(s) }

// ── Router ────────────────────────────────────────────────────────────────────
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

// ── /search — fan out to each site, scrape recipe cards ───────────────────────
async function handleSearch(query, sitesParam) {
  if (!query) return json({ error: 'q param required' }, 400)

  const enabledDomains = (sitesParam || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (enabledDomains.length === 0) return json([])

  // Fan out: fetch all enabled site search pages in parallel
  const perSiteResults = await Promise.allSettled(
    enabledDomains.map(domain => scrapeSite(domain, query))
  )

  // Flatten results, skip any site that failed
  const results = perSiteResults
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .filter(r => r.title && r.url)

  return json(results)
}

async function scrapeSite(domain, query) {
  const urlBuilder = SITE_SEARCH[domain]
  if (!urlBuilder) return []

  const searchUrl = urlBuilder(query)

  let res
  try {
    res = await fetch(searchUrl, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      // 8s timeout — enough for slow sites, prevents the Worker from hanging
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return []
  }

  if (!res.ok) return []

  const html = await res.text()

  // 1. Try JSON-LD on the search page (Serious Eats and some others embed it)
  const ldResults = extractSearchJsonLd(html, domain)
  if (ldResults.length >= 2) return ldResults.slice(0, 6)

  // 2. Fall back to HTML link extraction
  return extractRecipeLinks(html, domain, searchUrl)
}

// ── Extract recipe cards from JSON-LD on the search results page ──────────────
function extractSearchJsonLd(html, domain) {
  const results = []
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m

  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim())
      const items = flattenGraph(data)

      for (const item of items) {
        // SearchResultsPage → mainEntity → ItemList
        if (item['@type'] === 'SearchResultsPage' && item.mainEntity) {
          const list = Array.isArray(item.mainEntity.itemListElement)
            ? item.mainEntity.itemListElement
            : []
          for (const entry of list) {
            const r = entry.item || entry
            if (r.name && r.url) {
              results.push({
                title:       r.name,
                url:         r.url,
                image:       getImage(r.image),
                description: r.description || '',
                site:        domain.replace(/^www\./, ''),
              })
            }
          }
        }

        // ItemList of recipes directly
        if (item['@type'] === 'ItemList') {
          for (const entry of (item.itemListElement || [])) {
            const r = entry.item || entry
            if (r.name && r.url) {
              results.push({
                title:       r.name,
                url:         r.url,
                image:       getImage(r.image),
                description: r.description || '',
                site:        domain.replace(/^www\./, ''),
              })
            }
          }
        }

        // Individual Recipe objects embedded in search page
        if (
          (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) &&
          item.name && item.url
        ) {
          results.push({
            title:       item.name,
            url:         item.url,
            image:       getImage(item.image),
            description: item.description || '',
            site:        domain.replace(/^www\./, ''),
          })
        }
      }
    } catch {}
  }

  return results
}

// ── Generic HTML extractor ────────────────────────────────────────────────────
// Pass 1: <article> blocks — WordPress recipe blogs always put search result cards in <article>
// Pass 2: named card divs — AllRecipes, NYT Cooking, Bon Appétit, etc.
function extractRecipeLinks(html, domain, searchUrl) {
  const baseUrl = `https://${domain}`
  const seen    = new Set()
  const results = []

  // Pass 1 — <article> blocks
  const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi
  let am
  while ((am = articleRe.exec(html)) !== null && results.length < 8) {
    const card = parseBlock(am[1], domain, baseUrl, /* lenient= */ true)
    if (card && !seen.has(card.url)) { seen.add(card.url); results.push(card) }
  }

  if (results.length >= 3) return results

  // Pass 2 — named card divs
  const cardRe = /<div[^>]+class="[^"]*(?:card|result|recipe-item|search-result|recipe-list-item|listing)[^"]*"[^>]*>([\s\S]{80,2500}?)<\/div>/gi
  let dm
  while ((dm = cardRe.exec(html)) !== null && results.length < 8) {
    const card = parseBlock(dm[1], domain, baseUrl, /* lenient= */ false)
    if (card && !seen.has(card.url)) { seen.add(card.url); results.push(card) }
  }

  return results
}

// Parse a block of HTML (article or named div) → recipe card or null
function parseBlock(blockHtml, domain, baseUrl, lenient) {
  const linkRe = /<a\s[^>]*href=["']([^"'#?][^"']*)["'][^>]*>/gi
  let lm, href = null

  while ((lm = linkRe.exec(blockHtml)) !== null) {
    let h = lm[1].trim()
    if (h.startsWith('/')) h = baseUrl + h
    if (!h.startsWith('http')) continue

    let hostname
    try { hostname = new URL(h).hostname } catch { continue }

    const sameDomain = hostname === domain
      || hostname === `www.${domain}`
      || `www.${hostname}` === domain
    if (!sameDomain) continue

    // Lenient mode (inside <article>): skip obvious non-recipe patterns only
    // Strict mode: apply full URL heuristics
    if (lenient) {
      if (SKIP_URL_PATTERNS.some(re => re.test(h))) continue
    } else {
      if (!looksLikeRecipeUrl(h)) continue
    }

    href = h
    break
  }

  if (!href) return null

  // Title: h2/h3 preferred over anchor text
  const headingMatch = blockHtml.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)
  let title = headingMatch ? cleanText(stripTags(headingMatch[1])) : ''
  if (!title) {
    const aText = blockHtml.match(/<a[^>]+href=["'][^"']+["'][^>]*>([^<]{5,120})<\/a>/i)
    title = aText ? cleanText(stripTags(aText[1])) : ''
  }

  if (!title || title.length < 5 || title.length > 120) return null
  if (looksLikeCategory(title)) return null

  const image = extractFirstImage(blockHtml) || ''
  const descMatch = blockHtml.match(/<p[^>]*>([\s\S]{20,250}?)<\/p>/i)
  const desc = cleanText(stripTags(descMatch?.[1] || ''))

  return {
    title,
    url:   href,
    image: resolveImageUrl(image, baseUrl),
    description: desc.length > 20 && desc !== title ? desc : '',
    site:  domain.replace(/^www\./, ''),
  }
}

// Reject titles that are clearly collection/category pages, not individual recipes
function looksLikeCategory(title) {
  return /^(most popular|collections?|soups?(?: and | & )stews?|easy side dishes?|quick(?: and | & )easy|healthy recipes?|dinner ideas?|chicken recipes?|beef recipes?|vegetarian recipes?|vegan recipes?|pasta recipes?|salad recipes?|one[ -]pan meals?|sheet pan|meal prep|browse all|see all|more recipes?|popular recipes?|featured recipes?)\s*$/i.test(title)
}

// ── URL heuristics ────────────────────────────────────────────────────────────
const SKIP_URL_PATTERNS = [
  /\/(author|authors|category|categories|tag|tags|page|pages|search|about|contact|privacy|terms|faq|shop|subscribe|login|register|account|cart|checkout|sitemap|feed|rss|cdn-cgi|newsletter|collection|collections|roundup|roundups)\b/i,
  /\.(jpg|jpeg|png|gif|webp|svg|pdf|css|js|xml|txt|ico)(\?|$)/i,
  /#/,
]

function looksLikeRecipeUrl(url) {
  for (const re of SKIP_URL_PATTERNS) if (re.test(url)) return false

  // Site-specific exact patterns
  if (/allrecipes\.com\/recipe\/\d+/i.test(url))        return true
  if (/food52\.com\/recipes\/\d+/i.test(url))           return true
  if (/thekitchn\.com\/.+-\d{6,}/i.test(url))           return true
  if (/bonappetit\.com\/recipe\//i.test(url))            return true
  if (/cooking\.nytimes\.com\/recipes\/\d+/i.test(url)) return true
  if (/seriouseats\.com\/.+-recipe(-\d+)?$/i.test(url)) return true

  // /recipe/ singular followed by a specific page
  if (/\/recipe\/[^/]{4,}/i.test(url)) return true

  // WordPress slug: final path segment has 3+ hyphens = 4+ word recipe name
  try {
    const pathEnd = new URL(url).pathname.replace(/\/$/, '').split('/').pop() || ''
    if ((pathEnd.match(/-/g) || []).length >= 3) return true
  } catch {}

  return false
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/&\w+;/g, ' ')
}

function cleanText(str) {
  return str.replace(/\s+/g, ' ').trim()
}

function extractFirstImage(html) {
  // Try src first, then data-src (lazy loading), then srcset
  return html.match(/(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*?)["']/i)?.[1]
      || html.match(/srcset=["']([^"' ]+)/i)?.[1]
      || null
}

function resolveImageUrl(src, baseUrl) {
  if (!src) return ''
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) return baseUrl + src
  return src
}

// ── /recipe — fetch and parse a recipe page ───────────────────────────────────
async function handleRecipe(targetUrl) {
  if (!targetUrl) return json({ error: 'url param required' }, 400)

  let res
  try {
    res = await fetch(targetUrl, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    return json({ error: `Could not fetch page: ${err.message}` }, 502)
  }

  if (!res.ok) return json({ error: `Upstream returned ${res.status}` }, 502)

  const html = await res.text()

  const recipe = extractJsonLd(html) || extractOpenGraph(html, targetUrl)
  if (!recipe) return json({ error: 'Could not parse recipe from this page.' }, 422)

  recipe.sourceUrl  = targetUrl
  recipe.sourceSite = new URL(targetUrl).hostname.replace(/^www\./, '')

  return json(recipe)
}

// ── JSON-LD recipe extraction (primary) ───────────────────────────────────────
function extractJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m

  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim())
      for (const item of flattenGraph(data)) {
        if (
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        ) {
          return normalizeRecipe(item)
        }
      }
    } catch {}
  }
  return null
}

function flattenGraph(data) {
  if (Array.isArray(data)) return data
  if (data['@graph']) return data['@graph']
  return [data]
}

function normalizeRecipe(r) {
  return {
    title:       r.name || '',
    description: stripTags(r.description || '').slice(0, 400),
    image:       getImage(r.image),
    ingredients: (r.recipeIngredient || []).map(parseIngredient),
    steps:       extractSteps(r.recipeInstructions),
    prepTime:    parseDuration(r.prepTime),
    cookTime:    parseDuration(r.cookTime),
    servings:    parseServings(r.recipeYield),
    rating:      r.aggregateRating?.ratingValue ? parseFloat(r.aggregateRating.ratingValue) : 0,
    genre:       [r.recipeCategory, r.recipeCuisine].flat().filter(Boolean),
    keywords:    r.keywords ? String(r.keywords).split(',').map(s => s.trim()).filter(Boolean) : [],
  }
}

// ── OpenGraph fallback (gets title + image when no JSON-LD) ───────────────────
function extractOpenGraph(html, url) {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
             || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split('|')[0]?.trim()
  if (!title) return null

  const image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] || ''
  const desc  = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
             || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]
             || ''

  return {
    title:       title.trim(),
    description: stripTags(desc).slice(0, 400),
    image,
    ingredients: [],
    steps:       [],
    prepTime:    0,
    cookTime:    0,
    servings:    0,
    rating:      0,
    genre:       [],
    keywords:    [],
  }
}

// ── Ingredient parser ─────────────────────────────────────────────────────────
// Handles: unicode fractions, mixed numbers, ranges, parenthetical notes
const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
}

const UNITS = [
  'tablespoon','tablespoons','tbsp','tbs',
  'teaspoon','teaspoons','tsp',
  'cup','cups','c',
  'fluid ounce','fluid ounces','fl oz',
  'ounce','ounces','oz',
  'pound','pounds','lb','lbs',
  'gram','grams','g',
  'kilogram','kilograms','kg',
  'milliliter','milliliters','ml','mL',
  'liter','liters','l','L',
  'clove','cloves',
  'bunch','bunches',
  'slice','slices',
  'piece','pieces',
  'can','cans',
  'package','packages','pkg',
  'stick','sticks',
  'quart','quarts','qt',
  'pint','pints','pt',
  'gallon','gallons',
  'inch','inches',
  'large','medium','small',
  'pinch','pinches',
  'dash','dashes',
  'handful','handfuls',
].join('|')

const UNIT_RE = new RegExp(`^(${UNITS})s?\\b`, 'i')

function normaliseQty(s) {
  // Replace unicode fractions
  s = s.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, f => UNICODE_FRACTIONS[f] || f)
  // Evaluate simple fractions: "1/2" → 0.5
  // Keep as string for display; just normalize whitespace
  return s.trim()
}

function parseIngredient(raw) {
  if (typeof raw !== 'string') return { quantity: '', unit: '', name: String(raw) }

  let str = raw.trim()

  // Replace unicode fractions
  str = str.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, f => UNICODE_FRACTIONS[f] || f)

  // Strip leading bullet, dash, asterisk
  str = str.replace(/^[•\-\*]\s*/, '')

  // Try to extract quantity (number, fraction, range, or mixed number)
  // e.g. "1 1/2", "2-3", "1/4", "2.5", "12"
  const qtyRe = /^(\d+(?:[\/\-]\d+)?(?:\s+\d+\/\d+)?|\d*\.\d+)\s*/
  const qtyMatch = str.match(qtyRe)
  let quantity = ''
  if (qtyMatch) {
    quantity = qtyMatch[1].trim()
    str = str.slice(qtyMatch[0].length)
  }

  // Try to extract unit
  const unitMatch = str.match(UNIT_RE)
  let unit = ''
  if (unitMatch) {
    unit = unitMatch[1]
    str = str.slice(unitMatch[0].length).trim()
  }

  // Strip leading "of " after unit
  str = str.replace(/^of\s+/i, '')

  // Strip trailing parenthetical notes like "(optional)", "(about 200g)"
  const name = str.replace(/\s*\([^)]{0,40}\)\s*$/, '').trim()

  return { quantity, unit, name: name || str.trim() }
}

// ── Recipe step extraction ────────────────────────────────────────────────────
function extractSteps(instructions) {
  if (!instructions) return []
  if (typeof instructions === 'string') return instructions.split(/\n+/).filter(Boolean)
  if (Array.isArray(instructions)) {
    return instructions.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (item['@type'] === 'HowToSection') return extractSteps(item.itemListElement)
      return [stripTags(item.text || item.name || '')]
    }).filter(Boolean)
  }
  return []
}

// ── Small helpers ─────────────────────────────────────────────────────────────
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

function parseServings(y) {
  if (!y) return 0
  const n = parseInt(Array.isArray(y) ? y[0] : y)
  return isNaN(n) ? 0 : n
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
