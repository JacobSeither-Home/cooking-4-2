import { useState, useCallback } from 'react'
import { Search, Link2, X, Sparkles } from 'lucide-react'

// ── Spelling suggestion via Datamuse (free, no key) ───────────────────────────
async function suggestSpelling(query) {
  const words = query.trim().split(/\s+/)
  try {
    const corrected = await Promise.all(words.map(async (word) => {
      if (word.length < 4) return word   // skip short words like "and", "for"
      const res  = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&max=1`)
      const data = await res.json()
      return (data.length > 0 && data[0].word !== word.toLowerCase()) ? data[0].word : word
    }))
    const suggestion = corrected.join(' ')
    return suggestion.toLowerCase() !== query.toLowerCase() ? suggestion : null
  } catch {
    return null
  }
}
import { PageHeader, EmptyState, SkeletonCard, DecoDivider } from '../components/DecoFrame'
import RecipeCard from '../components/RecipeCard'
import { useRecipes, useSites } from '../hooks/useFirestore'
import { searchRecipes, importRecipeFromUrl } from '../services/recipeService'
import { getRecommendations } from '../services/recommendationService'
import { useMealPlan } from '../hooks/useFirestore'
import RecipeDetailModal from '../components/RecipeDetailModal'

export default function DiscoverPage() {
  const { recipes, saveRecipe, deleteRecipe } = useRecipes()
  const { sites }  = useSites()
  const { plans }  = useMealPlan()

  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [urlInput,   setUrlInput]   = useState('')
  const [showUrlBar, setShowUrlBar] = useState(false)
  const [searching,  setSearching]  = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [error,      setError]      = useState(null)
  const [selected,   setSelected]   = useState(null)  // recipe to show in modal
  const [suggestion, setSuggestion] = useState(null)  // spelling suggestion

  const savedIds = new Set(recipes.map(r => r.sourceUrl))

  // Get currently planned recipes for recommendation engine
  const plannedRecipeIds = new Set(plans.map(p => p.recipeId))
  const plannedRecipes   = recipes.filter(r => plannedRecipeIds.has(r.id))
  const recommendations  = getRecommendations(plannedRecipes, recipes, 5)

  const runSearch = useCallback(async (q) => {
    setSearching(true)
    setError(null)
    setResults([])
    setSuggestion(null)
    try {
      const [data, spell] = await Promise.all([
        searchRecipes(q, sites),
        suggestSpelling(q),
      ])
      setResults(data)
      // Only surface spelling suggestion if results look thin (< 3) or query differs
      if (spell && data.length < 3) setSuggestion(spell)
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }, [sites])

  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    await runSearch(query)
  }, [query, runSearch])

  const handleSuggestionClick = useCallback(async (spell) => {
    setQuery(spell)
    setSuggestion(null)
    await runSearch(spell)
  }, [runSearch])

  const handleImportUrl = useCallback(async () => {
    if (!urlInput.trim()) return
    setImporting(true)
    setError(null)
    try {
      const recipe = await importRecipeFromUrl(urlInput)
      setSelected(recipe)
      setUrlInput('')
      setShowUrlBar(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }, [urlInput])

  // Clicking a search result: show a preview immediately, fetch the full recipe in the background
  const handleSelectRecipe = useCallback(async (recipe) => {
    // Normalize field names — search results use 'url'/'site', saved recipes use 'sourceUrl'/'sourceSite'
    const normalized = {
      ...recipe,
      sourceUrl:  recipe.sourceUrl  || recipe.url,
      sourceSite: recipe.sourceSite || recipe.site,
    }

    // Saved recipes already have full data — open directly
    if (recipe.ingredients?.length > 0) {
      setSelected(normalized)
      return
    }

    // Search result stub: show preview immediately, then fill in full recipe
    setSelected({ ...normalized, _loading: true })
    try {
      const full = await importRecipeFromUrl(normalized.sourceUrl)
      // Merge so we keep sourceUrl/sourceSite even if the worker response uses different names
      setSelected({
        ...full,
        sourceUrl:  full.sourceUrl  || normalized.sourceUrl,
        sourceSite: full.sourceSite || normalized.sourceSite,
        image:      full.image      || normalized.image,
      })
    } catch (err) {
      // Keep the partial preview visible; show error inside the modal
      setSelected(prev => ({ ...prev, _loading: false, _loadError: err.message }))
    }
  }, [])

  const handleSave = useCallback(async (recipe) => {
    await saveRecipe(recipe)
  }, [saveRecipe])

  const tabs = results.length > 0 ? 'results' : 'saved'
  const displayRecipes = tabs === 'results' ? results : recipes

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Discover"
        subtitle={`${sites.filter(s => s.enabled).length} sites · ${recipes.length} saved`}
        icon={Search}
      />

      <div className="px-4 space-y-3">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30" />
            <input
              type="text"
              placeholder="Search recipes across your sites…"
              value={query}
              onChange={e => { setQuery(e.target.value); setSuggestion(null) }}
              className="w-full pl-9 pr-4"
              spellCheck
            />
          </div>
          <button type="submit" className="btn-gold px-4">Go</button>
          <button
            type="button"
            onClick={() => setShowUrlBar(v => !v)}
            className={`btn-icon ${showUrlBar ? 'border-gold/50 text-gold' : ''}`}
            title="Import from URL"
          >
            <Link2 size={15} />
          </button>
        </form>

        {/* URL import bar */}
        {showUrlBar && (
          <div className="flex gap-2 animate-slide-up">
            <input
              type="url"
              placeholder="Paste a recipe URL to import…"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImportUrl()}
              className="flex-1"
              autoFocus
            />
            <button
              onClick={handleImportUrl}
              disabled={importing || !urlInput}
              className="btn-pink px-4 disabled:opacity-40"
            >
              {importing ? '…' : 'Import'}
            </button>
            <button onClick={() => setShowUrlBar(false)} className="btn-icon">
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs text-pink bg-pink/10 border border-pink/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Recommendations (only when planning and have saved recipes) */}
        {recommendations.length > 0 && !results.length && (
          <div className="mt-2">
            <DecoDivider label="Efficient picks" />
            <p className="text-xs text-cream/40 mb-3 font-body">
              These share ingredients with your planned meals — fewer groceries needed.
            </p>
            <div className="space-y-3">
              {recommendations.map(({ recipe, sharedIngredients }) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  saved={true}
                  showBadge="recommend"
                  sharedCount={sharedIngredients.length}
                  onClick={() => handleSelectRecipe(recipe)}
                />
              ))}
            </div>
            <DecoDivider label="All saved" />
          </div>
        )}
      </div>

      {/* Recipe grid */}
      <div className="px-4 mt-3">
        {searching ? (
          <div className="grid grid-cols-1 gap-3">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : displayRecipes.length === 0 ? (
          <EmptyState
            icon={Search}
            title={results.length === 0 && !query ? 'Start searching' : 'No results'}
            message={
              results.length === 0 && !query
                ? 'Search your favorite recipe sites above, or import a URL directly.'
                : `Try different keywords or add more sites in Settings.`
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {displayRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id || recipe.url}
                recipe={recipe}
                saved={savedIds.has(recipe.sourceUrl || recipe.url)}
                onSave={() => handleSave(recipe)}
                onClick={() => handleSelectRecipe(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recipe detail modal */}
      {selected && (
        <RecipeDetailModal
          recipe={selected}
          isSaved={savedIds.has(selected.sourceUrl || selected.url)}
          onSave={() => handleSave(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
