import { useState } from 'react'
import { Settings, Plus, Trash2, Globe, LogOut, ChevronDown, ChevronUp, User } from 'lucide-react'
import { PageHeader, DecoDivider, DecoSunburst } from '../components/DecoFrame'
import { useAuth } from '../hooks/useAuth'
import { useSites } from '../hooks/useFirestore'

const GENRE_OPTIONS = ['all','american','italian','asian','mexican','mediterranean','indian','french','vegetarian','vegan','seafood','comfort','baking','quick']

export default function SettingsPage() {
  const { user, profile, logout }  = useAuth()
  const { sites, loading, saveSites } = useSites()
  const [expandedSite, setExpandedSite] = useState(null)
  const [addingNew,    setAddingNew]    = useState(false)

  const toggleSite = async (id, enabled) => {
    const updated = sites.map(s => s.id === id ? { ...s, enabled } : s)
    await saveSites(updated)
  }

  const updateSite = async (id, changes) => {
    const updated = sites.map(s => s.id === id ? { ...s, ...changes } : s)
    await saveSites(updated)
  }

  const deleteSite = async (id) => {
    await saveSites(sites.filter(s => s.id !== id))
  }

  const addSite = async (site) => {
    await saveSites([...sites, { ...site, id: site.domain.replace(/\./g,'_'), enabled: true }])
    setAddingNew(false)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" icon={Settings} />

      <div className="px-4 space-y-4 pb-8">

        {/* Profile */}
        <section className="card p-4">
          <div className="flex items-center gap-3">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-gold/30" />
              : <div className="w-12 h-12 rounded-full bg-raised border border-border flex items-center justify-center">
                  <User size={20} className="text-cream/40" />
                </div>
            }
            <div className="flex-1">
              <p className="font-display text-base text-cream">{user?.displayName}</p>
              <p className="text-xs text-cream/40">{user?.email}</p>
              <div className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border
                ${profile?.house === 'jacob'
                  ? 'bg-gold/10 text-gold border-gold/30'
                  : 'bg-pink/10 text-pink border-pink/30'}`}>
                {profile?.house === 'jacob' ? "Jacob's house" : "Caroline's house"}
              </div>
            </div>
            <button onClick={logout} className="btn-icon text-cream/30 hover:text-pink">
              <LogOut size={15} />
            </button>
          </div>
        </section>

        <DecoDivider label="Recipe Sites" />

        {/* Sites list */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-cream/40 font-body">
              {sites.filter(s => s.enabled).length} active · search and import from these sites
            </p>
            <button onClick={() => setAddingNew(true)} className="btn-icon w-7 h-7">
              <Plus size={13} />
            </button>
          </div>

          <div className="space-y-2">
            {sites.map(site => (
              <SiteRow
                key={site.id}
                site={site}
                expanded={expandedSite === site.id}
                onExpand={() => setExpandedSite(expandedSite === site.id ? null : site.id)}
                onToggle={(enabled) => toggleSite(site.id, enabled)}
                onUpdate={(changes) => updateSite(site.id, changes)}
                onDelete={() => deleteSite(site.id)}
              />
            ))}
          </div>

          {addingNew && (
            <AddSiteForm onAdd={addSite} onCancel={() => setAddingNew(false)} />
          )}
        </section>

        <DecoDivider />

        {/* About */}
        <section className="text-center py-4">
          <DecoSunburst size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-display text-cream/30 text-sm italic">Cooking 4 2</p>
          <p className="text-cream/20 text-xs mt-1">Jacob & Caroline's private kitchen</p>
        </section>
      </div>
    </div>
  )
}

function SiteRow({ site, expanded, onExpand, onToggle, onUpdate, onDelete }) {
  return (
    <div className={`card transition-all ${site.enabled ? 'border-border' : 'opacity-50'}`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-raised/30"
        onClick={onExpand}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${site.enabled ? 'bg-gold' : 'bg-border'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display text-cream truncate">{site.name}</p>
          <p className="text-[11px] text-cream/30 truncate">{site.domain}</p>
        </div>
        {/* Toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(!site.enabled) }}
          className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0
            ${site.enabled ? 'bg-gold/80' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-cream transition-all
            ${site.enabled ? 'left-5' : 'left-0.5'}`} />
        </button>
        {expanded ? <ChevronUp size={13} className="text-cream/30" /> : <ChevronDown size={13} className="text-cream/30" />}
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3 animate-slide-up">
          {/* Search path */}
          <div>
            <label className="input-label">Search URL path</label>
            <input
              type="text"
              value={site.searchPath}
              onChange={e => onUpdate({ searchPath: e.target.value })}
              className="w-full text-xs"
              placeholder="e.g. /search?q="
            />
          </div>

          {/* Min rating */}
          <div>
            <label className="input-label">Minimum rating (0 = any)</label>
            <input
              type="number"
              min={0} max={5} step={0.5}
              value={site.minRating || 0}
              onChange={e => onUpdate({ minRating: parseFloat(e.target.value) })}
              className="w-24 text-xs"
            />
          </div>

          {/* Genre filters */}
          <div>
            <label className="input-label">Genre filters</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {GENRE_OPTIONS.map(g => {
                const active = site.genres?.includes(g) || site.genres?.includes('all')
                return (
                  <button
                    key={g}
                    onClick={() => {
                      const genres = site.genres?.includes(g)
                        ? site.genres.filter(x => x !== g)
                        : [...(site.genres || []), g]
                      onUpdate({ genres: genres.length ? genres : ['all'] })
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all capitalize
                      ${active ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border text-cream/30 hover:border-border/80'}`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={onDelete}
            className="text-xs text-cream/30 hover:text-pink flex items-center gap-1 transition-colors"
          >
            <Trash2 size={11} /> Remove site
          </button>
        </div>
      )}
    </div>
  )
}

function AddSiteForm({ onAdd, onCancel }) {
  const [name,   setName]   = useState('')
  const [domain, setDomain] = useState('')
  const [path,   setPath]   = useState('/search?q=')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !domain) return
    onAdd({ name, domain, searchPath: path, genres: ['all'], minRating: 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-3 mt-2 space-y-2 border-gold/20 animate-slide-up">
      <p className="text-xs font-display text-gold/70 uppercase tracking-widest">Add site</p>
      <input type="text"  placeholder="Site name (e.g. Pinch of Yum)" value={name}   onChange={e => setName(e.target.value)}   className="w-full text-xs" required />
      <input type="text"  placeholder="Domain (e.g. pinchofyum.com)"   value={domain} onChange={e => setDomain(e.target.value)} className="w-full text-xs" required />
      <input type="text"  placeholder="Search path (e.g. /search?q=)"  value={path}   onChange={e => setPath(e.target.value)}   className="w-full text-xs" />
      <div className="flex gap-2">
        <button type="submit"  className="btn-gold flex-1 text-xs py-2">Add</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-xs py-2">Cancel</button>
      </div>
    </form>
  )
}
