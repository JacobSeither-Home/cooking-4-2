import { useState, useMemo } from 'react'
import { Calendar, Plus, Trash2, ChefHat, ShoppingCart, MoveRight } from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { PageHeader, EmptyState, DecoDivider, HouseBadge } from '../components/DecoFrame'
import { RecipeListItem } from '../components/RecipeCard'
import { useMealPlan, useRecipes } from '../hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { buildGroceryList } from '../services/recipeService'
import { useGroceryLists } from '../hooks/useFirestore'

export default function MealPlanPage() {
  const { plans, loading, removePlan, updatePlan } = useMealPlan()
  const { recipes } = useRecipes()
  const { createList } = useGroceryLists()
  const navigate = useNavigate()

  const [weekOffset, setWeekOffset] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [movingPlanId, setMovingPlanId] = useState(null)

  // Build the 7-day week
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Group plans by date
  const plansByDate = useMemo(() => {
    const map = {}
    for (const plan of plans) {
      const key = plan.date
      if (!map[key]) map[key] = []
      map[key].push(plan)
    }
    return map
  }, [plans])

  const weekPlans = plans.filter(p => {
    const d = parseISO(p.date)
    return d >= days[0] && d <= days[6]
  })

  const handleGenerateGroceryList = async () => {
    if (weekPlans.length === 0) return
    setGenerating(true)
    try {
      const weekRecipes = weekPlans
        .map(p => recipes.find(r => r.id === p.recipeId))
        .filter(Boolean)

      const items = buildGroceryList(weekRecipes)
      const name  = `Week of ${format(days[0], 'MMM d')}`
      const ref   = await createList(name, weekPlans.map(p => p.id), items)
      navigate('/grocery')
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const cycleAssignment = (plan) => {
    const next = plan.assignedTo === 'both' ? 'jacob'
               : plan.assignedTo === 'jacob' ? 'caroline'
               : 'both'
    updatePlan(plan.id, { assignedTo: next })
  }

  const movePlanToDay = (planId, newDate) => {
    updatePlan(planId, { date: newDate })
    setMovingPlanId(null)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Meal Plan"
        subtitle={`${weekPlans.length} meal${weekPlans.length !== 1 ? 's' : ''} this week`}
        icon={Calendar}
        action={
          weekPlans.length > 0 && (
            <button
              onClick={handleGenerateGroceryList}
              disabled={generating}
              className="btn-gold text-sm px-3 py-2"
            >
              <ShoppingCart size={14} />
              {generating ? '…' : 'Grocery List'}
            </button>
          )
        }
      />

      {/* Week navigator */}
      <div className="px-4 flex items-center justify-between mb-3">
        <button onClick={() => setWeekOffset(w => w - 1)} className="btn-icon w-7 h-7 text-xs">‹</button>
        <span className="font-display text-sm text-cream/60">
          {format(days[0], 'MMM d')} – {format(days[6], 'MMM d, yyyy')}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="btn-icon w-7 h-7 text-xs">›</button>
      </div>

      <div className="px-4 space-y-2 pb-4">
        {days.map(day => {
          const key   = format(day, 'yyyy-MM-dd')
          const meals = plansByDate[key] || []
          const isToday = isSameDay(day, new Date())

          return (
            <div key={key} className={`card ${isToday ? 'border-gold/30 shadow-gold' : ''}`}>
              {/* Day header */}
              <div className={`flex items-center justify-between px-3 py-2 border-b border-border
                ${isToday ? 'bg-gold/5' : 'bg-raised/50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-display text-sm ${isToday ? 'text-gold' : 'text-cream/60'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-xs ${isToday ? 'text-gold/70' : 'text-cream/30'}`}>
                    {format(day, 'MMM d')}
                  </span>
                  {isToday && <span className="tag-gold text-[9px] px-1 py-0">Today</span>}
                </div>
                <AddMealButton date={key} recipes={recipes} />
              </div>

              {/* Meals */}
              {meals.length === 0 ? (
                <div className="px-3 py-3 text-xs text-cream/20 italic font-body">No meals planned</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {meals.map(plan => (
                    <div key={plan.id}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {plan.recipeImage
                          ? <img src={plan.recipeImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-raised flex items-center justify-center text-lg flex-shrink-0">🍴</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display text-cream truncate">{plan.recipeTitle}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-cream/30">{plan.servings} servings</span>
                            {/* Clickable badge cycles Jacob → Caroline → Both */}
                            <button
                              onClick={() => cycleAssignment(plan)}
                              title="Tap to change who's eating"
                              className="hover:opacity-70 transition-opacity"
                            >
                              <HouseBadge house={plan.assignedTo || 'both'} size="xs" />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {/* Move to day */}
                          <button
                            onClick={() => setMovingPlanId(movingPlanId === plan.id ? null : plan.id)}
                            className={`btn-icon w-7 h-7 ${movingPlanId === plan.id ? 'text-gold' : 'text-cream/40 hover:text-gold'}`}
                            title="Move to different day"
                          >
                            <MoveRight size={13} />
                          </button>
                          <button
                            onClick={() => navigate('/cook', { state: { planId: plan.id } })}
                            className="btn-icon w-7 h-7 text-cream/40 hover:text-gold"
                            title="Cook this"
                          >
                            <ChefHat size={13} />
                          </button>
                          <button
                            onClick={() => removePlan(plan.id)}
                            className="btn-icon w-7 h-7 text-cream/30 hover:text-pink"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Move-to-day picker */}
                      {movingPlanId === plan.id && (
                        <div className="px-3 pb-2.5 pt-0">
                          <p className="text-[10px] text-cream/40 mb-1.5">Move to:</p>
                          <div className="flex flex-wrap gap-1">
                            {days.map(d => {
                              const dKey = format(d, 'yyyy-MM-dd')
                              const isCurrent = dKey === plan.date
                              return (
                                <button
                                  key={dKey}
                                  onClick={() => !isCurrent && movePlanToDay(plan.id, dKey)}
                                  disabled={isCurrent}
                                  className={`text-[11px] px-2 py-1 rounded-md transition-colors
                                    ${isCurrent
                                      ? 'bg-gold/20 text-gold cursor-default'
                                      : 'bg-raised hover:bg-gold/10 hover:text-gold text-cream/50'
                                    }`}
                                >
                                  {format(d, 'EEE d')}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inline add-meal picker ────────────────────────────────────────────────────
function AddMealButton({ date, recipes }) {
  const { addPlan } = useMealPlan()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [assignedTo, setAssignedTo] = useState('both')

  const filtered = recipes.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 6)

  const handlePick = async (recipe) => {
    await addPlan({
      date,
      recipeId:    recipe.id,
      recipeTitle: recipe.title,
      recipeImage: recipe.image || null,
      sourceSite:  recipe.sourceSite || '',
      servings:    recipe.servings || 2,
      notes:       '',
      assignedTo,
    })
    setOpen(false)
    setSearch('')
    setAssignedTo('both')
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-icon w-6 h-6 text-cream/30 hover:text-gold">
        <Plus size={13} />
      </button>
    )
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-40 w-72 card shadow-gold border-gold/20 animate-slide-up"
         style={{ position: 'relative' }}>
      <div className="p-2 border-b border-border">
        <input
          type="text"
          placeholder="Search saved recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs py-1.5"
          autoFocus
        />
      </div>

      {/* Who's eating selector */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="text-[10px] text-cream/40">Who's eating:</span>
        {['both', 'jacob', 'caroline'].map(opt => (
          <button
            key={opt}
            onClick={() => setAssignedTo(opt)}
            className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors
              ${assignedTo === opt ? 'bg-gold/20 text-gold' : 'text-cream/40 hover:text-cream'}`}
          >
            {opt}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <p className="text-xs text-cream/30 px-3 py-2">No saved recipes yet</p>
        : <ul>
            {filtered.map(r => (
              <li key={r.id}>
                <button
                  onClick={() => handlePick(r)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-raised transition-colors text-left"
                >
                  {r.image
                    ? <img src={r.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-raised flex-shrink-0" />
                  }
                  <span className="text-xs text-cream truncate">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
      }
      <button onClick={() => setOpen(false)} className="w-full text-xs text-cream/30 py-1.5 hover:text-cream border-t border-border">
        Cancel
      </button>
    </div>
  )
}
