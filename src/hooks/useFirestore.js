import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, query, where, orderBy, limit,
  addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, getDocs, getDoc, serverTimestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './useAuth'

// ── Recipes ──────────────────────────────────────────────────────────────────
export function useRecipes() {
  const [recipes, setRecipes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'recipes'), orderBy('savedAt', 'desc'), limit(100))
    const unsub = onSnapshot(q, snap => {
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  const saveRecipe = useCallback(async (recipe) => {
    const ref = collection(db, 'recipes')
    return addDoc(ref, { ...recipe, savedBy: user.uid, savedAt: serverTimestamp() })
  }, [user])

  const deleteRecipe = useCallback(async (id) => {
    await deleteDoc(doc(db, 'recipes', id))
  }, [])

  return { recipes, loading, saveRecipe, deleteRecipe }
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────
export function useMealPlan() {
  const [plans, setPlans]   = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'mealPlans'), orderBy('date', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  const addPlan = useCallback(async (plan) => {
    return addDoc(collection(db, 'mealPlans'), {
      ...plan, createdBy: user.uid, createdAt: serverTimestamp()
    })
  }, [user])

  const removePlan = useCallback(async (id) => {
    await deleteDoc(doc(db, 'mealPlans', id))
  }, [])

  const updatePlan = useCallback(async (id, data) => {
    await updateDoc(doc(db, 'mealPlans', id), data)
  }, [])

  return { plans, loading, addPlan, removePlan, updatePlan }
}

// ── Grocery Lists ─────────────────────────────────────────────────────────────
export function useGroceryLists() {
  const [lists, setLists]   = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'groceryLists'), orderBy('createdAt', 'desc'), limit(10))
    const unsub = onSnapshot(q, snap => {
      setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  const createList = useCallback(async (name, mealPlanIds, items) => {
    return addDoc(collection(db, 'groceryLists'), {
      name, mealPlanIds, items, createdBy: user.uid, createdAt: serverTimestamp()
    })
  }, [user])

  const toggleItem = useCallback(async (listId, itemIndex, checked) => {
    const ref   = doc(db, 'groceryLists', listId)
    const snap  = await getDoc(ref)
    const items = [...snap.data().items]
    items[itemIndex] = { ...items[itemIndex], checked }
    await updateDoc(ref, { items })
  }, [])

  const deleteList = useCallback(async (id) => {
    await deleteDoc(doc(db, 'groceryLists', id))
  }, [])

  // Merge a single meal's grocery items into the most recent list (or create one)
  const mergeIntoList = useCallback(async (planId, newItems) => {
    if (lists.length === 0) {
      return addDoc(collection(db, 'groceryLists'), {
        name: 'My Grocery List',
        mealPlanIds: [planId],
        items: newItems,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
    }

    // Merge into most recent list
    const target  = lists[0]
    const listRef = doc(db, 'groceryLists', target.id)
    const existing = [...(target.items || [])]

    for (const item of newItems) {
      const idx = existing.findIndex(i => i.ingredient === item.ingredient)
      if (idx >= 0) {
        const ex = existing[idx]
        const qa = parseFloat(ex.quantity) || 0
        const qb = parseFloat(item.quantity) || 0
        const combined = ex.unit === item.unit
          ? String(qa + qb)
          : `${ex.quantity || ''} + ${item.quantity || ''}`.trim().replace(/^\+\s*/, '')
        existing[idx] = { ...ex, quantity: combined }
      } else {
        existing.push(item)
      }
    }

    await updateDoc(listRef, {
      items: existing,
      mealPlanIds: arrayUnion(planId),
    })
  }, [lists, user])

  // Remove a plan's association from all lists (items stay, just delinks the plan)
  const removePlanFromList = useCallback(async (planId) => {
    const matching = lists.filter(l => l.mealPlanIds?.includes(planId))
    await Promise.all(matching.map(l =>
      updateDoc(doc(db, 'groceryLists', l.id), {
        mealPlanIds: arrayRemove(planId),
      })
    ))
  }, [lists])

  return { lists, loading, createList, toggleItem, deleteList, mergeIntoList, removePlanFromList }
}

// ── Pantry ────────────────────────────────────────────────────────────────────
export function usePantry(houseId) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // houseId = 'jacob' | 'caroline'
  const ownerId = houseId || user?.uid

  useEffect(() => {
    if (!ownerId) return
    // Use a shared pantry doc per house (keyed by house name for cross-user access)
    const q = query(collection(db, 'pantry', ownerId, 'items'), orderBy('name'))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [ownerId])

  const addItem = useCallback(async (item) => {
    return addDoc(collection(db, 'pantry', ownerId, 'items'), {
      ...item, addedAt: serverTimestamp()
    })
  }, [ownerId])

  const removeItem = useCallback(async (id) => {
    await deleteDoc(doc(db, 'pantry', ownerId, 'items', id))
  }, [ownerId])

  const updateItem = useCallback(async (id, data) => {
    await updateDoc(doc(db, 'pantry', ownerId, 'items', id), data)
  }, [ownerId])

  return { items, loading, addItem, removeItem, updateItem }
}

// ── Sites Settings ────────────────────────────────────────────────────────────
export function useSites() {
  const [sites, setSites]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ref  = doc(db, 'settings', 'sites')
    const unsub = onSnapshot(ref, async snap => {
      if (snap.exists()) {
        setSites(snap.data().sites || [])
      } else {
        // Initialize with default sites
        await setDoc(ref, { sites: DEFAULT_SITES })
        setSites(DEFAULT_SITES)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const saveSites = useCallback(async (newSites) => {
    await setDoc(doc(db, 'settings', 'sites'), { sites: newSites })
  }, [])

  return { sites, loading, saveSites }
}

// ── Default recipe sites ──────────────────────────────────────────────────────
export const DEFAULT_SITES = [
  { id: 'seriouseats',     domain: 'www.seriouseats.com',    name: 'Serious Eats',        searchPath: '/search?q=', enabled: true, genres: ['all'], minRating: 0 },
  { id: 'budgetbytes',     domain: 'www.budgetbytes.com',    name: 'Budget Bytes',        searchPath: '/?s=',       enabled: true, genres: ['all'], minRating: 0 },
  { id: 'halfbakedharvest',domain: 'www.halfbakedharvest.com',name: 'Half Baked Harvest', searchPath: '/?s=',       enabled: true, genres: ['all'], minRating: 0 },
  { id: 'smittenkitchen',  domain: 'smittenkitchen.com',     name: 'Smitten Kitchen',     searchPath: '/?s=',       enabled: true, genres: ['all'], minRating: 0 },
  { id: 'allrecipes',      domain: 'www.allrecipes.com',     name: 'AllRecipes',          searchPath: '/search?q=', enabled: true, genres: ['all'], minRating: 0 },
  { id: 'food52',          domain: 'food52.com',             name: 'Food52',              searchPath: '/recipes/search?q=', enabled: true, genres: ['all'], minRating: 0 },
  { id: 'thekitchn',       domain: 'www.thekitchn.com',      name: 'The Kitchn',         searchPath: '/recipes?q=', enabled: true, genres: ['all'], minRating: 0 },
  { id: 'bonappetit',      domain: 'www.bonappetit.com',     name: 'Bon Appétit',        searchPath: '/search?q=', enabled: true, genres: ['all'], minRating: 0 },
  { id: 'minimalistbaker', domain: 'minimalistbaker.com',    name: 'Minimalist Baker',    searchPath: '/?s=',       enabled: true, genres: ['all'], minRating: 0 },
]
