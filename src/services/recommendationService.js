// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Service
// Suggests recipes that share ingredients with currently-selected meals,
// helping you shop efficiently by minimizing unique ingredients needed.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeIngredientName } from './recipeService'

function getIngredientSet(recipe) {
  return new Set(
    (recipe.ingredients || []).map(i =>
      (i.name || i).toLowerCase().trim().replace(/\s+/g, ' ')
    )
  )
}

// Score a candidate recipe against a set of already-selected ingredient names.
// Returns { score, sharedIngredients, newIngredients }
function scoreRecipe(candidate, selectedIngredients) {
  const candidateSet = getIngredientSet(candidate)
  const shared = [...candidateSet].filter(i => selectedIngredients.has(i))
  const isNew  = [...candidateSet].filter(i => !selectedIngredients.has(i))

  // Scoring: heavily reward sharing; lightly penalize many new ingredients
  const score = shared.length * 3 - isNew.length * 0.5
  return {
    score,
    sharedIngredients: shared,
    newIngredients:    isNew.length,
  }
}

/**
 * Given a list of already-selected recipes and a library of saved recipes,
 * return up to `maxResults` recommendations sorted by ingredient overlap.
 *
 * @param {object[]} selectedRecipes  – meals already in the plan
 * @param {object[]} allRecipes       – full saved recipe library
 * @param {number}   maxResults
 * @returns {Array<{ recipe, score, sharedIngredients, newIngredients }>}
 */
export function getRecommendations(selectedRecipes, allRecipes, maxResults = 5) {
  if (selectedRecipes.length === 0 || allRecipes.length === 0) return []

  const selectedIds = new Set(selectedRecipes.map(r => r.id))

  // Build the combined ingredient pool from selected meals
  const selectedIngredients = new Set()
  for (const r of selectedRecipes) {
    for (const i of getIngredientSet(r)) {
      selectedIngredients.add(i)
    }
  }

  const scored = allRecipes
    .filter(r => !selectedIds.has(r.id))
    .map(r => ({ recipe: r, ...scoreRecipe(r, selectedIngredients) }))
    .filter(r => r.sharedIngredients.length > 0)        // must share at least one
    .sort((a, b) => b.score - a.score || a.newIngredients - b.newIngredients)
    .slice(0, maxResults)

  return scored
}

/**
 * Given a list of pantry items (from both houses) and a recipe,
 * return which ingredients are already stocked and which need to be bought.
 */
export function checkPantryForRecipe(recipe, jacobItems, carolineItems) {
  const allPantry = new Set([
    ...jacobItems.map(i => i.name.toLowerCase()),
    ...carolineItems.map(i => i.name.toLowerCase()),
  ])

  const stocked = []
  const needed  = []

  for (const ing of (recipe.ingredients || [])) {
    const name = (ing.name || ing).toLowerCase()
    const match = [...allPantry].some(p => name.includes(p) || p.includes(name))
    if (match) stocked.push(ing)
    else        needed.push(ing)
  }

  return { stocked, needed, stockedCount: stocked.length, total: recipe.ingredients?.length || 0 }
}
