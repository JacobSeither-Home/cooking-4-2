import { NavLink } from 'react-router-dom'
import { Compass, Calendar, ShoppingCart, Archive, Settings } from 'lucide-react'

const NAV = [
  { to: '/discover',  label: 'Discover',  Icon: Compass       },
  { to: '/plan',      label: 'Plan',       Icon: Calendar      },
  { to: '/grocery',   label: 'Grocery',    Icon: ShoppingCart  },
  { to: '/pantry',    label: 'Pantry',     Icon: Archive       },
  { to: '/settings',  label: 'Settings',   Icon: Settings      },
]

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 nav-safe bg-surface border-t border-border">
      {/* Gold top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="flex items-center justify-around px-2 pt-1">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200 min-w-[56px]
               ${isActive
                 ? 'text-gold'
                 : 'text-cream/30 hover:text-cream/60 active:scale-90'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
