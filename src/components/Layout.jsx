import NavBar from './NavBar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-base bg-deco-pattern">
      {/* Content area with bottom padding for nav */}
      <main className="pb-24 min-h-screen">
        {children}
      </main>
      <NavBar />
    </div>
  )
}
