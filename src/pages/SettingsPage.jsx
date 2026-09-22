import { useState } from 'react'
import { Settings, Trash2, Plus, Globe, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader, DecoDivider } from '../components/DecoFrame'
import { useSites, DEFAULT_SITES } from '../hooks/useFirestore'

export default function SettingsPage() {
  const { sites, saveSites } = useSites()
  const [saving, setSaving]  = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [newName,   setNewName]   = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [addError,  setAddError]  = useState('')

  const toggle = async (id) => {
    setSaving(true)
    const updated = sites.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    await saveSites(updated)
    setSaving(false)
  }

  const remove = async (id) => {
    setSaving(true)
    await saveSites(sites.filter(s => s.id !== id))
    setSaving(false)
  }

  const handleAdd = async () => {
    setAddError('')
    const domain = newDomain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    const name   = newName.trim()
    if (!domain) { setAddError('Enter a domain.'); return }
    if (!name)   { setAddError('Enter a display name.'); return }
    if (sites.some(s => s.domain === domain)) { setAddError('That site is already in the list.'); return }

    setSaving(true)
    const newSite = {
      id:         domain.replace(/\W+/g, '-'),
      domain,
      name,
      searchPath: '/?s=',   // sensible default; user can't edit right now
      enabled:    true,
      genres:     ['all'],
      minRating:  0,
    }
    await saveSites([...sites, newSite])
    setNewDomain('')
    setNewName('')
    setShowAdd(false)
    setSaving(false)
  }

  const resetToDefaults = async () => {
    if (!confirm('Reset to the default site list? This will overwrite your current sites.')) return
    setSaving(true)
    await saveSites(DEFAULT_SITES)
    setSaving(false)
  }

  const enabledCount = sites.filter(s => s.enabled).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle={`${enabledCount} of ${sites.length} sites enabled`}
        icon={Settings}
      />

      <div className="px-4 space-y-4 pb-8">
        <DecoDivider label="Recipe Sites" />
        <p className="text-xs text-cream/40 font-body -mt-2">
          Toggle sites on or off for search. Remove any site you don't want.
        </p>

        <div className="space-y-2">
          {sites.map(site => (
            <div
              key={site.id}
              className={`card flex items-center gap-3 px-3 py-3 transition-opacity ${!site.enabled ? 'opacity-50' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg bg-raised border border-border flex items-center justify-center flex-shrink-0">
                <Globe size={14} className="text-cream/30" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-display text-cream truncate">{site.name}</p>
                <p className="text-[11px] text-cream/30 truncate">{site.domain}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(site.id)}
                disabled={saving}
                className={`flex-shrink-0 transition-colors ${site.enabled ? 'text-gold' : 'text-cream/20'}`}
                title={site.enabled ? 'Disable' : 'Enable'}
              >
                {site.enabled
                  ? <ToggleRight size={24} />
                  : <ToggleLeft  size={24} />
                }
              </button>

              {/* Remove */}
              <button
                onClick={() => remove(site.id)}
                disabled={saving}
                className="btn-icon w-7 h-7 text-cream/20 hover:text-pink flex-shrink-0"
                title="Remove site"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add site */}
        {showAdd ? (
          <div className="card p-3 space-y-2 animate-slide-up">
            <p className="text-xs font-display text-gold/70 uppercase tracking-widest">Add a site</p>
            <input
              type="text"
              placeholder="Domain  (e.g. www.budgetbytes.com)"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              className="w-full text-sm"
              autoFocus
            />
            <input
              type="text"
              placeholder="Display name  (e.g. Budget Bytes)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="w-full text-sm"
            />
            {addError && (
              <p className="text-xs text-pink">{addError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving} className="btn-gold flex-1 text-sm py-2">
                {saving ? '…' : 'Add Site'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddError('') }} className="btn-ghost text-sm py-2 px-4">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full btn-ghost flex items-center justify-center gap-2 text-sm py-3"
          >
            <Plus size={14} />
            Add a site
          </button>
        )}

        <DecoDivider />

        <button
          onClick={resetToDefaults}
          className="w-full text-xs text-cream/30 hover:text-cream/60 transition-colors py-1"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
