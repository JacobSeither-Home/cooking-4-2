import { X, Clock, Users, ExternalLink, BookmarkCheck, Bookmark, Plus, Loader } from 'lucide-react'
import { StarRating, DecoDivider } from './DecoFrame'
import { useMealPlan } from '../hooks/useFirestore'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RecipeDetailModal({ recipe, isSaved, onSave, onClose }) {
  const { addPlan } = useMealPlan()
  const navigate    = useNavigate()
  const [adding, setAdding] = useState(false)
  const [added,  setAdded]  = useState(false)

  const handleAddToPlan = async () => {
    setAdding(true)
    await addPlan({
      date:        new Date().toISOString().split('T')[0],
      recipeId:    recipe.id || null,
      recipeTitle: recipe.title,
      recipeImage: recipe.image || null,
      sourceSite:  recipe.sourceSite || '',
      servings:    recipe.servings || 2,
      notes:       '',
      assignedTo:  'both',
    })
    setAdded(true)
    setAdding(false)
  }

  const isLoading = recipe._loading === true
  const loadError = recipe._loadError

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-base/90 backdrop-blur-sm flex items-end justify-center overflow-hidden"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Sheet — flex column so only the body scrolls */}
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-t-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Drag handle — never scrolls away */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          {/* Image */}
          {recipe.image && (
            <div className="relative h-56 overflow-hidden flex-shrink-0">
              <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
            </div>
          )}

          <div className="px-5 pb-8 space-y-4">
            {/* Title + meta */}
            <div>
              <div className="flex items-start justify-between gap-3 mt-2">
                <h2 className="font-display text-2xl text-cream leading-tight flex-1">{recipe.title}</h2>
                <button onClick={onClose} className="btn-icon flex-shrink-0">
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-cream/50">
                {(recipe.sourceSite || recipe.site) && (
                  <span className="bg-raised border border-border px-2 py-0.5 rounded-full text-cream/60">
                    {recipe.sourceSite || recipe.site}
                  </span>
                )}
                {recipe.prepTime && (
                  <span className="flex items-center gap-1"><Clock size={11} /> {recipe.prepTime + (recipe.cookTime || 0)} min</span>
                )}
                {recipe.servings && (
                  <span className="flex items-center gap-1"><Users size={11} /> {recipe.servings} servings</span>
                )}
                {recipe.rating > 0 && <StarRating rating={recipe.rating} size={12} />}
              </div>

              {recipe.description && (
                <p className="text-sm text-cream/60 mt-2 leading-relaxed">{recipe.description}</p>
              )}
            </div>

            <DecoDivider />

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-6 text-cream/40">
                <Loader size={20} className="animate-spin text-gold/60" />
                <p className="text-xs font-body">Fetching full recipe…</p>
                <div className="w-full space-y-2 mt-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold/20 flex-shrink-0" />
                      <div className="skeleton h-3 rounded flex-1" style={{ opacity: 0.6 - i * 0.1 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Load error */}
            {loadError && !isLoading && (
              <div className="text-xs text-pink bg-pink/10 border border-pink/20 rounded-lg px-3 py-2">
                Couldn't load full recipe: {loadError}
              </div>
            )}

            {/* Ingredients */}
            {!isLoading && recipe.ingredients?.length > 0 && (
              <section>
                <h3 className="font-display text-sm text-gold/80 uppercase tracking-widest mb-3">Ingredients</h3>
                <ul className="space-y-1.5">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-cream/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold/40 mt-1.5 flex-shrink-0" />
                      <span>
                        {ing.quantity && <span className="text-gold/70">{ing.quantity} {ing.unit} </span>}
                        {ing.name || ing}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Steps */}
            {!isLoading && recipe.steps?.length > 0 && (
              <section>
                <h3 className="font-display text-sm text-gold/80 uppercase tracking-widest mb-3">Method</h3>
                <ol className="space-y-3">
                  {recipe.steps.slice(0, 3).map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-cream/70 leading-relaxed">
                      <span className="step-bubble flex-shrink-0">{i + 1}</span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                  {recipe.steps.length > 3 && (
                    <p className="text-xs text-cream/30 pl-11">+{recipe.steps.length - 3} more steps</p>
                  )}
                </ol>
              </section>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onSave}
                className={`flex-1 ${isSaved ? 'btn-ghost' : 'btn-gold'}`}
              >
                {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                {isSaved ? 'Saved' : 'Save Recipe'}
              </button>

              <button
                onClick={handleAddToPlan}
                disabled={adding || isLoading}
                className="flex-1 btn-pink disabled:opacity-50"
              >
                <Plus size={15} />
                {added ? 'Added!' : adding ? '…' : 'Add to Plan'}
              </button>
            </div>

            {(recipe.sourceUrl || recipe.url) && (
              <a
                href={recipe.sourceUrl || recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-cream/30 hover:text-gold transition-colors"
              >
                <ExternalLink size={12} />
                View on {recipe.sourceSite || recipe.site || 'original site'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
