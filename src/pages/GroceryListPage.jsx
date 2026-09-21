import { useState } from 'react'
import { ShoppingCart, Trash2, Plus, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, EmptyState, DecoDivider, HouseBadge } from '../components/DecoFrame'
import { useGroceryLists } from '../hooks/useFirestore'
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

export default function GroceryListPage() {
  const { lists, loading, toggleItem, deleteList } = useGroceryLists()
  const { profile } = useAuth()
  const [activeListId, setActiveListId] = useState(null)
  const [collapsedCats, setCollapsedCats] = useState({})

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
                        {collapsed ? <ChevronRight size={13} className="text-cream/30" /> : <ChevronDown size={13} className="text-cream/30" />}
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
                          // Find global index in items array
                          const globalIdx = activeList.items.indexOf(item)
                          return (
                            <GroceryItem
                              key={idx}
                              item={item}
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

function GroceryItem({ item, onToggle, myHouse }) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-200 cursor-pointer
        ${item.checked ? 'opacity-40' : 'hover:bg-raised/30'}`}
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

      <div className="flex-1 min-w-0">
        <span className={`text-sm font-body ${item.checked ? 'line-through text-cream/30' : 'text-cream'}`}>
          {item.quantity && <span className="text-gold/70 mr-1">{item.quantity} {item.unit}</span>}
          {item.ingredient}
        </span>
      </div>

      {item.assignedTo && item.assignedTo !== 'both' && (
        <HouseBadge house={item.assignedTo} size="xs" />
      )}
    </li>
  )
}
