import { useState, useMemo } from 'react'
import { ShoppingCart, Trash2, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, EmptyState, HouseBadge } from '../components/DecoFrame'
import { useGroceryLists, usePantry } from '../hooks/useFirestore'
import { useAuth } from '../hooks/useAuth'

const CATEGORY_LABELS = {
  produce:  '🥦 Produce',
  protein:  '🥩 Protein',
  dairy:    '🧀 Dairy',
  grains:   '🌾 Grains',
  pantry:   '🫙 Pantry',
  frozen:   '🧊 Frozen',
  other:    '📦 Other',
}

// ── Pantry fuzzy match ────────────────────────────────────────────────────────
// Returns 'jacob' | 'caroline' | 'both' | null
function pantryMatch(ingredientName, jacobItems, carolineItems) {
  const norm = ingredientName.toLowerCase().trim()
  const inJ = jacobItems.some(p => {
    const pn = (p.name || '').toLowerCase().trim()
    return pn.includes(norm) || norm.includes(pn)
  })
  const inC = carolineItems.some(p => {
    const pn = (p.name || '').toLowerCase().trim()
    return pn.includes(norm) || norm.includes(pn)
  })
  if (inJ && inC) return 'both'
  if (inJ) return 'jacob'
  if (inC) return 'caroline'
  return null
}

export default function GroceryListPage() {
  const { lists, loading, toggleItem, deleteList } = useGroceryLists()
  const { profile } = useAuth()
  const [activeListId, setActiveListId]     = useState(null)
  const [collapsedCats, setCollapsedCats]   = useState({})

  // Load both pantries for overlap detection
  const jacobPantry    = usePantry('jacob')
  const carolinePantry = usePantry('caroline')

  const activeList = activeListId
    ? lists.find(l => l.id === activeListId)
    : lists[0]

  if (loading) return <div className="p-8 text-center text-cream/30">Loading…</div>

  if (lists.length === 0) return (
    <div className="animate-fade-in">
      <PageHeader title="Grocery List" icon={ShoppingCart} />
      <EmptyState
        icon={ShoppingCart}
        title="No lists yet"
        message="Add meals to your plan, then tap 'Grocery List' to generate one."
      />
    </div>
  )

  // Group items by category
  const grouped = {}
  for (const item of (activeList?.items || [])) {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const checkedCount = activeList?.items?.filter(i => i.checked).length || 0
  const totalCount   = activeList?.items?.length || 0
  const progress     = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  const toggleCat = (cat) => setCollapsedCats(c => ({ ...c, [cat]: !c[cat] }))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Grocery List"
        icon={ShoppingCart}
        subtitle={activeList ? `${checkedCount}/${totalCount} items` : ''}
        action={
          activeList && (
            <button
              onClick={() => deleteList(activeList.id)}
              className="btn-icon text-cream/30 hover:text-pink"
            >
              <Trash2 size={14} />
            </button>
          )
        }
      />

      {/* List selector (if multiple) */}
      {lists.length > 1 && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto pb-1">
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all
                ${(activeList?.id === list.id)
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-border text-cream/40 hover:border-gold/30'}`}
            >
              {list.name}
            </button>
          ))}
        </div>
      )}

      {activeList && (
        <>
          {/* Progress bar */}
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between text-xs text-cream/40 mb-1.5">
              <span>{activeList.name}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Pantry legend (only if pantries have data) */}
          {(jacobPantry.items.length > 0 || carolinePantry.items.length > 0) && (
            <div className="px-4 mb-3 flex items-center gap-3 text-[10px] text-cream/30">
              <span>In pantry:</span>
              <span className="text-gold/60">◆ Jacob</span>
              <span className="text-pink/60">◆ Caroline</span>
            </div>
          )}

          {/* Items by category */}
          <div className="px-4 space-y-2 pb-4">
            {Object.entries(CATEGORY_LABELS)
              .filter(([cat]) => grouped[cat]?.length)
              .map(([cat, label]) => {
                const items     = grouped[cat] || []
                const collapsed = collapsedCats[cat]
                const doneCount = items.filter(i => i.checked).length

                return (
                  <div key={cat} className="card overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-raised/50 hover:bg-raised transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {collapsed
                          ? <ChevronRight size={13} className="text-cream/30" />
                          : <ChevronDown size={13} className="text-cream/30" />
                        }
                        <span className="text-sm font-display text-cream/80">{label}</span>
                        <span className="text-xs text-cream/30">{doneCount}/{items.length}</span>
                      </div>
                      {doneCount === items.length && items.length > 0 && (
                        <CheckCheck size={14} className="text-gold" />
                      )}
                    </button>

                    {/* Items */}
                    {!collapsed && (
                      <ul className="divide-y divide-border/40">
                        {items.map((item, idx) => {
                          const globalIdx   = activeList.items.indexOf(item)
                          const inPantry    = pantryMatch(
                            item.ingredient,
                            jacobPantry.items,
                            carolinePantry.items
                          )
                          return (
                            <GroceryItem
                              key={idx}
                              item={item}
                              inPantry={inPantry}
                              onToggle={() => toggleItem(activeList.id, globalIdx, !item.checked)}
                              myHouse={profile?.house}
                            />
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })
            }
          </div>
        </>
      )}
    </div>
  )
}

function GroceryItem({ item, inPantry, onToggle, myHouse }) {
  // Pantry badge: gold=jacob, pink=caroline, split=both
  const pantryBadge = inPantry ? (
    <span
      title={`In ${inPantry === 'both' ? "both pantries" : `${inPantry}'s pantry`}`}
      className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0
        ${inPantry === 'jacob'    ? 'bg-gold/10   text-gold   border-gold/30'   :
          inPantry === 'caroline' ? 'bg-pink/10   text-pink   border-pink/30'   :
                                    'bg-surface    text-cream/40 border-border'}`}
    >
      {inPantry === 'both'
        ? <span><span className="text-gold">J</span> <span className="text-pink">C</span></span>
        : inPantry === 'jacob' ? 'J' : 'C'}
    </span>
  ) : null

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-200 cursor-pointer
        ${item.checked ? 'opacity-40' : 'hover:bg-raised/30'}
        ${inPantry ? 'bg-raised/20' : ''}`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all
        ${item.checked ? 'bg-gold border-gold' : 'border-border hover:border-gold/50'}`}>
        {item.checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#0D0608" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Ingredient name */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-body ${item.checked ? 'line-through text-cream/30' : 'text-cream'}`}>
          {item.quantity && <span className="text-gold/70 mr-1">{item.quantity} {item.unit}</span>}
          {item.ingredient}
        </span>
        {inPantry && !item.checked && (
          <p className={`text-[10px] mt-0.5
            ${inPantry === 'jacob'    ? 'text-gold/50'   :
              inPantry === 'caroline' ? 'text-pink/50'   :
                                        'text-cream/30'}`}>
            {inPantry === 'both'
              ? 'In both pantries'
              : `In ${inPantry}'s pantry`}
          </p>
        )}
      </div>

      {/* Pantry badge */}
      {pantryBadge}

      {/* Assigned-to badge (only if not both) */}
      {item.assignedTo && item.assignedTo !== 'both' && (
        <HouseBadge house={item.assignedTo} size="xs" />
      )}
    </li>
  )
}
