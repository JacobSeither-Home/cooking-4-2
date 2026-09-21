import { useState } from 'react'
import { Archive, Plus, Trash2, Search } from 'lucide-react'
import { PageHeader, EmptyState, DecoDivider } from '../components/DecoFrame'
import { usePantry } from '../hooks/useFirestore'
import { useAuth } from '../hooks/useAuth'
import { categorizeIngredient } from '../services/recipeService'

const HOUSES = [
  { id: 'jacob',    label: "Jacob's Pantry",    accent: 'text-gold',  border: 'border-gold/30', badge: 'tag-gold' },
  { id: 'caroline', label: "Caroline's Pantry", accent: 'text-pink',  border: 'border-pink/30', badge: 'tag-pink' },
]

export default function PantryPage() {
  const { profile } = useAuth()
  const [activeHouse, setActiveHouse] = useState(profile?.house || 'jacob')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const jacob    = usePantry('jacob')
  const caroline = usePantry('caroline')
  const pantry   = activeHouse === 'jacob' ? jacob : caroline

  const myHouse  = profile?.house
  const canEdit  = activeHouse === myHouse

  const filtered = pantry.items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category
  const grouped = {}
  for (const item of filtered) {
    const cat = item.category || categorizeIngredient(item.name)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pantry"
        subtitle="What's stocked at each house"
        icon={Archive}
      />

      {/* House tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {HOUSES.map(h => (
          <button
            key={h.id}
            onClick={() => setActiveHouse(h.id)}
            className={`flex-1 py-2 rounded-lg border text-sm font-display transition-all
              ${activeHouse === h.id
                ? `${h.border} ${h.accent} bg-surface`
                : 'border-border text-cream/30 hover:border-border/80'}`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30" />
            <input
              type="text"
              placeholder="Search pantry…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          {canEdit && (
            <button onClick={() => setAdding(true)} className="btn-gold px-3">
              <Plus size={15} />
            </button>
          )}
        </div>

        {/* Add item form */}
        {adding && canEdit && (
          <AddItemForm
            onAdd={async (item) => {
              await pantry.addItem({
                ...item,
                category: categorizeIngredient(item.name),
              })
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* Items */}
        {pantry.loading ? (
          <div className="text-xs text-cream/30 text-center py-8">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Pantry is empty"
            message={canEdit ? 'Add items you have at home to help with grocery planning.' : 'Nothing stocked here yet.'}
          />
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="card">
              <div className="px-3 py-2 bg-raised/50 border-b border-border">
                <span className="text-xs font-display text-cream/50 uppercase tracking-widest capitalize">{cat}</span>
              </div>
              <ul className="divide-y divide-border/40">
                {items.map(item => (
                  <PantryItem
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onRemove={() => pantry.removeItem(item.id)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PantryItem({ item, canEdit, onRemove }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 hover:bg-raised/20 transition-colors group">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-cream">{item.name}</span>
        {(item.quantity || item.unit) && (
          <span className="text-xs text-cream/40 ml-2">{item.quantity} {item.unit}</span>
        )}
      </div>
      {item.expiresAt && (
        <span className="text-[10px] text-cream/30">
          exp {new Date(item.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      {canEdit && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 btn-icon w-6 h-6 text-cream/30 hover:text-pink transition-all"
        >
          <Trash2 size={12} />
        </button>
      )}
    </li>
  )
}

function AddItemForm({ onAdd, onCancel }) {
  const [name,     setName]     = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit,     setUnit]     = useState('')
  const [expires,  setExpires]  = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), quantity, unit, expiresAt: expires || null })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-3 space-y-2 animate-slide-up border-gold/20">
      <input
        type="text"
        placeholder="Item name (e.g. Garlic)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full"
        autoFocus
        required
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Qty"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className="w-20"
        />
        <input
          type="text"
          placeholder="Unit (cups, lbs…)"
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="flex-1"
        />
        <input
          type="date"
          value={expires}
          onChange={e => setExpires(e.target.value)}
          className="w-36 text-xs"
          title="Expiration date (optional)"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1 text-sm py-2">Add</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
      </div>
    </form>
  )
}
