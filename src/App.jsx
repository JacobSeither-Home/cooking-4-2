import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage       from './pages/LoginPage'
import DiscoverPage    from './pages/DiscoverPage'
import MealPlanPage    from './pages/MealPlanPage'
import GroceryListPage from './pages/GroceryListPage'
import PantryPage      from './pages/PantryPage'
import CookPage        from './pages/CookPage'
import SettingsPage    from './pages/SettingsPage'
import { DecoSunburst } from './components/DecoFrame'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <DecoSunburst size={48} className="animate-shimmer" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/discover" replace />} />
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        {/* Child routes rendered inside Layout's <main> */}
      </Route>
      <Route path="/discover"  element={<ProtectedRoute><Layout><DiscoverPage    /></Layout></ProtectedRoute>} />
      <Route path="/plan"      element={<ProtectedRoute><Layout><MealPlanPage    /></Layout></ProtectedRoute>} />
      <Route path="/grocery"   element={<ProtectedRoute><Layout><GroceryListPage /></Layout></ProtectedRoute>} />
      <Route path="/pantry"    element={<ProtectedRoute><Layout><PantryPage      /></Layout></ProtectedRoute>} />
      <Route path="/cook"      element={<ProtectedRoute><Layout><CookPage        /></Layout></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><Layout><SettingsPage    /></Layout></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to="/discover" replace />} />
    </Routes>
  )
}
