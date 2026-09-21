import { Clock, Users, Bookmark, BookmarkCheck, Sparkles } from 'lucide-react'
import { StarRating } from './DecoFrame'

export default function RecipeCard({
  recipe,
  saved      = false,
  onSave,
  onClick,
  showBadge,      // 'recommend' | null
  sharedCount,    // number of shared ingredients
}) {
  const { title, description, image, sourceSite, prepTime, cookTime, servings, rating, genre } = recipe

  return (
    <div
      className="card-hover group animate-slide-up"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Image */}
      <div className="relative h-44 bg-raised overflow-hidden">
        {image
          ? <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🍳</div>
        }
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {showBadge === 'recommend' && (
            <span className="tag-gold text-[10px] flex items-center gap-1">
              <Sparkles size={9} /> {sharedCount} shared
            </span>
          )}
          {genre?.slice(0, 1).map(g => (
            <span key={g} className="tag-cream text-[10px]">{g}</span>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={e => { e.stopPropagation(); onSave?.() }}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-base/70 backdrop-blur flex items-center justify-center
                     text-gold hover:bg-gold/20 transition-all duration-200 active:scale-90"
        >
          {saved
            ? <BookmarkCheck size={15} />
            : <Bookmark size={15} className="opacity-70" />
          }
        </button>

        {/* Source site */}
        {sourceSite && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] text-cream/50 bg-base/70 backdrop-blur px-1.5 py-0.5 rounded">
              {sourceSite}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-display text-base text-cream leading-snug line-clamp-2">{title}</h3>

        {description && (
          <p className="text-xs text-cream/50 line-clamp-2 font-body">{description}</p>
        )}

        <div className="flex items-center justify-between pt-0.5">
          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-cream/40">
            {(prepTime || cookTime) && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {(prepTime || 0) + (cookTime || 0)} min
              </span>
            )}
            {servings && (
              <span className="flex items-center gap-1">
                <Users size={11} />
                {servings}
              </span>
            )}
          </div>

          {rating > 0 && <StarRating rating={rating} size={11} />}
        </div>
      </div>
    </div>
  )
}

// ── Compact list-style card ────────────────────────────────────────────────────
export function RecipeListItem({ recipe, onRemove, action }) {
  return (
    <div className="flex items-center gap-3 card px-3 py-2.5 animate-fade-in">
      {recipe.image
        ? <img src={recipe.image} alt={recipe.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        : <div className="w-12 h-12 rounded-lg bg-raised flex items-center justify-center text-xl flex-shrink-0">🍴</div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-cream truncate">{recipe.title}</p>
        <p className="text-[11px] text-cream/40">
          {[recipe.sourceSite, recipe.genre?.[0]].filter(Boolean).join(' · ')}
        </p>
      </div>
      {action || (onRemove && (
        <button onClick={onRemove} className="btn-icon text-cream/30 hover:text-pink w-7 h-7">
          ×
        </button>
      ))}
    </div>
  )
}
