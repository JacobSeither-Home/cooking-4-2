import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChefHat, ChevronLeft, ChevronRight, Check, ExternalLink } from 'lucide-react'
import { PageHeader, DecoDivider, DecoCornerFrame, DecoSunburst } from '../components/DecoFrame'
import { useMealPlan, useRecipes } from '../hooks/useFirestore'

export default function CookPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { plans, loading: plansLoading } = useMealPlan()
  const { recipes, loading: recipesLoading } = useRecipes()

  const planId = location.state?.planId
  const plan   = plans.find(p => p.id === planId)
  const recipe = plan ? recipes.find(r => r.id === plan.recipeId) : null

  const [step,    setStep]    = useState(0)
  const [checked, setChecked] = useState(new Set())
  const [timer,   setTimer]   = useState(null)
  const [running, setRunning] = useState(false)

  // Timer countdown
  useEffect(() => {
    if (!running || timer === null) return
    if (timer <= 0) { setRunning(false); return }
    const id = setInterval(() => setTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [running, timer])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (plansLoading || recipesLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <DecoSunburst size={48} className="animate-shimmer" />
      </div>
    )
  }

  // ── No recipe found (after loading is done) ──────────────────────────────
  if (!recipe) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Cook Mode" icon={ChefHat} />
        <div className="px-4 py-12 text-center">
          <p className="text-cream/40 mb-4 text-sm">No recipe selected for cooking.</p>
          <button onClick={() => navigate('/plan')} className="btn-ghost text-sm">
            ← Back to meal plan
          </button>
        </div>
      </div>
    )
  }

  const steps = recipe.steps || []
  const currentStep = steps[step]
  const isLast  = step === steps.length - 1
  const isFirst = step === 0

  const toggleIngredient = (i) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="animate-fade-in min-h-screen">
      {/* Header with image */}
      <div className="relative h-52">
        {recipe.image
          ? <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-raised flex items-center justify-center text-5xl">🍳</div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-transparent" />

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1 className="font-display text-2xl text-cream drop-shadow-lg">{recipe.title}</h1>
          {recipe.sourceSite && (
            <p className="text-xs text-cream/50 mt-0.5">{recipe.sourceSite}</p>
          )}
        </div>
      </div>

      <div className="px-4 pb-8 space-y-5 mt-3">

        {/* Ingredients checklist */}
        {recipe.ingredients?.length > 0 && (
          <section className="card p-4">
            <h2 className="font-display text-sm text-gold/80 uppercase tracking-widest mb-3">
              Ingredients
            </h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  onClick={() => toggleIngredient(i)}
                  className={`flex items-center gap-2.5 text-sm cursor-pointer transition-all
                    ${checked.has(i) ? 'opacity-40' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all
                    ${checked.has(i) ? 'bg-gold border-gold' : 'border-border'}`}>
                    {checked.has(i) && <Check size={10} stroke="#0D0608" strokeWidth={3} />}
                  </div>
                  <span className={checked.has(i) ? 'line-through text-cream/30' : 'text-cream/80'}>
                    {ing.quantity && <span className="text-gold/70">{ing.quantity} {ing.unit} </span>}
                    {ing.name || ing}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DecoDivider label="Step by step" />

        {/* Step navigator */}
        {steps.length > 0 ? (
          <DecoCornerFrame className="card p-5 space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-cream/40">
              <span>Step {step + 1} of {steps.length}</span>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? 'bg-gold w-4' : i < step ? 'bg-gold/40' : 'bg-border'}`}
                  />
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="flex gap-4">
              <div className="step-bubble flex-shrink-0 mt-0.5">{step + 1}</div>
              <p className="text-base text-cream/90 leading-relaxed flex-1">{currentStep}</p>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-3 pt-1">
              {[5, 10, 15].map(min => (
                <button
                  key={min}
                  onClick={() => { setTimer(min * 60); setRunning(false) }}
                  className="text-[10px] text-cream/30 hover:text-cream/60 border border-border rounded px-2 py-1"
                >
                  {min} min
                </button>
              ))}
              {timer !== null && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className={`font-mono text-sm font-medium ${timer < 60 ? 'text-pink' : 'text-gold'}`}>
                    {formatTime(timer)}
                  </span>
                  <button
                    onClick={() => setRunning(r => !r)}
                    className="btn-icon w-7 h-7 text-xs"
                  >
                    {running ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => { setTimer(null); setRunning(false) }}
                    className="text-cream/30 hover:text-pink text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={isFirst}
                className="btn-ghost flex-1 text-sm disabled:opacity-20"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              {isLast ? (
                <button
                  onClick={() => navigate('/plan')}
                  className="btn-gold flex-1 text-sm"
                >
                  Done! 🎉
                </button>
              ) : (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="btn-pink flex-1 text-sm"
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </div>
          </DecoCornerFrame>
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-cream/40 text-sm">No steps saved for this recipe.</p>
            {recipe.sourceUrl && (
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
                <ExternalLink size={14} /> View on {recipe.sourceSite || 'original site'}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
