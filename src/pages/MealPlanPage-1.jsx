import { useState, useMemo, useRef, useCallback } from 'react'
import { Calendar, Plus, Trash2, ChefHat, ShoppingCart, Check, X, GripVertical } from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { PageHeader, EmptyState, DecoDivider, HouseBadge } from '../components/DecoFrame'
import { useMealPlan, useRecipes, useGroceryLists } from '../hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { buildGroceryList } from '../services/recipeService'

// ── Genre derivation from recipe title ───────────────────────────────────────
const GENRE_PATTERNS = [
  { id: 'pasta',      label: 'Pasta',      re: /pasta|spaghetti|linguine|fettuccine|penne|rigatoni|lasagna|noodle|ramen/i },
  { id: 'chicken',    label: 'Chicken',    re: /chicken|poultry|turkey/i },
  { id: 'beef',       label: 'Beef',       re: /beef|steak|burger|meatball|brisket/i },
  { id: 'seafood',    label: 'Seafood',    re: /fish|salmon|tuna|shrimp|seafood|cod|halibut|scallop|crab|lobster/i },
  { id: 'vegetarian', label: 'Veg',        re: /vegetarian|vegan|tofu|tempeh|lentil|bean|chickpea|veggie/i },
  { id: 'salad',      label: 'Salad',      re: /salad/i },
  { id: 'soup',       label: 'Soup',       re: /soup|stew|chowder|chili|bisque|broth/i },
  { id: 'breakfast',  label: 'Breakfast',  re: /breakfast|pancake|waffle|omelette|egg|brunch|frittata/i },
  { id: 'pork',       label: 'Pork',       re: /pork|bacon|sausage|ham|ribs/i },
]

function getGenre(title = '') {
  for (const { id, re } of GENRE_PATTERNS) {
    if (re.test(title)) return id
  }
  return null
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MealPlanPage() {
  const { plans, loading, removePlan, updatePlan } = useMealPlan()
  const { recipes } = useRecipes()
  const { lists, createList, mergeIntoList } = useGroceryLists()
  const navigate = useNavigate()

  const [weekOffset, setWeekOffset] = useState(0)
  const [generating, setGenerating] = useState(false)

  // Drag state
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)

  // Build the 7-day week
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Group plans by date
  const plansByDate = useMemo(() => {
    const map = {}
    for (const plan of plans) {
      if (!map[plan.date]) map[plan.date] = []
      map[plan.date].push(plan)
    }
    return map
  }, [plans])

  const weekPlans = plans.filter(p => {
    const d = parseISO(p.date)
    return d >= days[0] && d <= days[6]
  })

  // Set of plan IDs that have been added to any grocery list
  const addedPlanIds = useMemo(() => {
    const ids = new Set()
    for (const list of lists) {
      for (const id of (list.mealPlanIds || [])) ids.add(id)
    }
    return ids
  }, [lists])

  const handleGenerateGroceryList = async () => {
    if (weekPlans.length === 0) return
    setGenerating(true)
    try {
      const weekRecipes = weekPlans
        .map(p => recipes.find(r => r.id === p.recipeId))
        .filter(Boolean)
      const items = buildGroceryList(weekRecipes)
      const name  = `Week of ${format(days[0], 'MMM d')}`
      await createList(name, weekPlans.map(p => p.id), items)
      navigate('/grocery')
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const handleAddToGrocery = useCallback(async (plan) => {
    const recipe = recipes.find(r => r.id === plan.recipeId)
    if (!recipe) return
    const items = buildGroceryList([recipe])
    await mergeIntoList(plan.id, items)
  }, [recipes, mergeIntoList])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e, planId) => {
    setDraggingId(planId)
    e.dataTransfer.effectAllowed = 'move'
    // Slight delay so the drag image renders before opacity change
    requestAnimationFrame(() => {
      e.target.style.opacity = '0.4'
    })
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = ''
    setDraggingId(null)
    setDragOverDate(null)
  }

  const handleDragOver = (e, dateKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateKey)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = async (e, dateKey) => {
    e.preventDefault()
    setDragOverDate(null)
    if (!draggingId) return
    const plan = plans.find(p => p.id === draggingId)
    if (plan && plan.date !== dateKey) {
      await updatePlan(draggingId, { date: dateKey })
    }
    setDraggingId(null)
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
              className="btn-gold text-sm px-3 py-2 flex items-center gap-1.5"
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
          const isToday   = isSameDay(day, new Date())
          const isDragOver = dragOverDate === key

          return (
            <div
              key={key}
              className={`card transition-all duration-150
                ${isToday ? 'border-gold/30 shadow-gold' : ''}
                ${isDragOver ? 'border-pink/50 bg-pink/5 shadow-[0_0_0_1px_rgba(232,98,138,0.3)]' : ''}`}
              onDragOver={e => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, key)}
            >
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
                <div className={`px-3 py-3 text-xs italic font-body transition-colors
                  ${isDragOver ? 'text-pink/40' : 'text-cream/20'}`}>
                  {isDragOver ? 'Drop here' : 'No meals planned'}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {meals.map(plan => (
                    <MealItem
                      key={plan.id}
                      plan={plan}
                      isAdded={addedPlanIds.has(plan.id)}
                      onCook={() => navigate('/cook', { state: { planId: plan.id } })}
                      onRemove={() => removePlan(plan.id)}
                      onAddGrocery={() => handleAddToGrocery(plan)}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
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

// ── Single meal row ───────────────────────────────────────────────────────────
function MealItem({ plan, isAdded, onCook, onRemove, onAddGrocery, onDragStart, onDragEnd }) {
  const [addingGrocery, setAddingGrocery] = useState(false)

  const handleAddGrocery = async () => {
    if (isAdded || addingGrocery) return
    setAddingGrocery(true)
    try {
      await onAddGrocery()
    } finally {
      setAddingGrocery(false)
    }
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, plan.id)}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing group"
    >
      {/* Drag handle */}
      <GripVertical size={12} className="text-cream/15 group-hover:text-cream/30 flex-shrink-0 transition-colors" />

      {/* Image */}
      {plan.recipeImage
        ? <img src={plan.recipeImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        : <div className="w-10 h-10 rounded-lg bg-raised flex items-center justify-center text-lg flex-shrink-0">🍴</div>
      }

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display text-cream truncate">{plan.recipeTitle}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-cream/30">{plan.servings} servings</span>
          <HouseBadge house={plan.assignedTo} size="xs" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 flex-shrink-0">
        {/* Add to grocery */}
        <button
          onClick={handleAddGrocery}
          disabled={addingGrocery}
          title={isAdded ? 'Added to grocery list' : 'Add to grocery list'}
          className={`btn-icon w-7 h-7 transition-all
            ${isAdded
              ? 'text-gold border-gold/30 bg-gold/10'
              : 'text-cream/30 hover:text-gold'}`}
        >
          {isAdded
            ? <Check size={12} />
            : addingGrocery
              ? <span className="text-[10px]">…</span>
              : <ShoppingCart size={12} />
          }
        </button>

        {/* Cook */}
        <button
          onClick={onCook}
          className="btn-icon w-7 h-7 text-cream/40 hover:text-gold"
          title="Cook this"
        >
          <ChefHat size={13} />
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="btn-icon w-7 h-7 text-cream/30 hover:text-pink"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Inline add-meal picker ────────────────────────────────────────────────────
function AddMealButton({ date, recipes }) {
  const { addPlan } = useMealPlan()
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const [genre, setGenre]     = useState(null)  // active genre filter

  // Derive genre for each recipe once
  const recipesWithGenre = useMemo(() =>
    recipes.map(r => ({ ...r, genre: getGenre(r.title) })),
    [recipes]
  )

  // Genres that appear in the saved recipes
  const availableGenres = useMemo(() => {
    const seen = new Set()
    for (const r of recipesWithGenre) {
      if (r.genre) seen.add(r.genre)
    }
    return GENRE_PATTERNS.filter(g => seen.has(g.id))
  }, [recipesWithGenre])

  const filtered = recipesWithGenre.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(search.toLowerCase())
    const matchesGenre  = !genre || r.genre === genre
    return matchesSearch && matchesGenre
  }).slice(0, 8)

  const handlePick = async (recipe) => {
    await addPlan({
      date,
      recipeId:    recipe.id,
      recipeTitle: recipe.title,
      recipeImage: recipe.image || null,
      sourceSite:  recipe.sourceSite || '',
      servings:    recipe.servings || 2,
      notes:       '',
      assignedTo:  'both',
    })
    setOpen(false)
    setSearch('')
    setGenre(null)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-icon w-6 h-6 text-cream/30 hover:text-gold">
        <Plus size={13} />
      </button>
    )
  }

  return (
    // Wrapper needed so the dropdown positions relative to the day card header row
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => { setOpen(false); setSearch(''); setGenre(null) }}
              className="btn-icon w-6 h-6 text-cream/30 hover:text-pink">
        <X size={13} />
      </button>
      <div className="absolute right-0 top-full mt-1 z-50 w-72 card shadow-gold border-gold/20 animate-slide-up">
        {/* Search */}
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

        {/* Genre filter chips */}
        {availableGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2 py-2 border-b border-border">
            <button
              onClick={() => setGenre(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all
                ${!genre ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-cream/30 hover:border-gold/30'}`}
            >
              All
            </button>
            {availableGenres.map(g => (
              <button
                key={g.id}
                onClick={() => setGenre(g.id === genre ? null : g.id)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all
                  ${genre === g.id ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-cream/30 hover:border-gold/30'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        {/* Recipe list */}
        {filtered.length === 0 ? (
          <p className="text-xs text-cream/30 px-3 py-3">No recipes match</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
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
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-cream truncate block">{r.title}</span>
                    {r.genre && (
                      <span className="text-[10px] text-cream/30 capitalize">{r.genre}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
