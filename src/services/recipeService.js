// ─────────────────────────────────────────────────────────────────────────────
// Recipe Service
// Communicates with the Cloudflare Worker proxy to fetch and parse recipes.
// Set VITE_WORKER_URL in your .env file (see README).
// ─────────────────────────────────────────────────────────────────────────────

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

// ── Fetch and parse a recipe from a URL ───────────────────────────────────────
export async function importRecipeFromUrl(url) {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL is not set. See README.')
  const res  = await fetch(`${WORKER_URL}/recipe?url=${encodeURIComponent(url)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch recipe (${res.status})`)
  }
  return res.json()
}

// ── Search across a list of sites ─────────────────────────────────────────────
export async function searchRecipes(query, sites = []) {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL is not set. See README.')
  const enabledDomains = sites.filter(s => s.enabled).map(s => s.domain)
  if (enabledDomains.length === 0) return []

  const params = new URLSearchParams({
    q: query,
    sites: enabledDomains.join(','),
  })
  const res = await fetch(`${WORKER_URL}/search?${params}`)
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  return res.json() // returns [{ title, url, image, description, site }]
}

// ── Ingredient category heuristics (client-side) ──────────────────────────────
const CATEGORY_MAP = {
  produce:    ['apple','banana','carrot','celery','garlic','ginger','onion','pepper','potato','tomato','lettuce','spinach','kale','lemon','lime','cucumber','avocado','mushroom','broccoli','cauliflower','zucchini','squash','herb','parsley','cilantro','basil','thyme','rosemary','mint','scallion','leek','shallot'],
  protein:    ['chicken','beef','pork','lamb','turkey','salmon','tuna','shrimp','fish','egg','tofu','tempeh','bacon','sausage','steak','ground'],
  dairy:      ['milk','cream','butter','cheese','yogurt','sour cream','cream cheese','mozzarella','parmesan','cheddar','feta','brie','ricotta','half and half'],
  grains:     ['rice','pasta','flour','bread','oat','quinoa','barley','couscous','noodle','tortilla','breadcrumb','panko','cornmeal'],
  pantry:     ['oil','vinegar','soy sauce','fish sauce','hot sauce','ketchup','mustard','mayonnaise','honey','sugar','salt','pepper','cumin','paprika','turmeric','cinnamon','oregano','bay leaf','stock','broth','can','tomato paste','coconut milk'],
  frozen:     ['frozen','ice cream'],
  other:      [],
}

export function categorizeIngredient(name) {
  const lower = name.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k))) return cat
  }
  return 'other'
}

// ── Build a grocery list from a set of recipes ────────────────────────────────
export function buildGroceryList(recipes) {
  const map = new Map()

  for (const recipe of recipes) {
    for (const ing of (recipe.ingredients || [])) {
      const key = normalizeIngredientName(ing.name || ing)
      if (map.has(key)) {
        const existing = map.get(key)
        map.set(key, { ...existing, quantity: combineQuantities(existing, ing) })
      } else {
        map.set(key, {
          ingredient: key,
          quantity:   ing.quantity || '',
          unit:       ing.unit     || '',
          category:   categorizeIngredient(key),
          checked:    false,
          assignedTo: 'both',
          recipeIds:  [recipe.id],
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
    a.ingredient.localeCompare(b.ingredient)
  )
}

const CATEGORY_ORDER = ['produce','protein','dairy','grains','pantry','frozen','other']

function normalizeIngredientName(name) {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(fresh|dried|chopped|minced|sliced|grated|cooked|raw|large|small|medium)\s+/i, '')
}

function combineQuantities(a, b) {
  const qa = parseFloat(a.quantity) || 0
  const qb = parseFloat(b.quantity) || 0
  if (a.unit === b.unit) return String(qa + qb)
  return `${a.quantity} + ${b.quantity || ''}`.trim()
}
