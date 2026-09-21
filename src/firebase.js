// ─────────────────────────────────────────────────────────────────────────────
// Firebase configuration
// Replace the placeholder values below with your own Firebase project's config.
// Get these from: Firebase Console → Project Settings → Your Apps → Web App
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')

// ─────────────────────────────────────────────────────────────────────────────
// Firestore data shape reference
// ─────────────────────────────────────────────────────────────────────────────
// /users/{uid}
//   displayName, email, photoURL, house: 'jacob' | 'caroline'
//
// /recipes/{recipeId}
//   title, description, image, sourceUrl, sourceSite, genre[], ingredients[],
//   steps[], prepTime, cookTime, servings, rating, savedBy: uid, savedAt
//
// /mealPlans/{planId}
//   date (ISO string), recipeId, recipeTitle, recipeImage, assignedTo: 'both'|uid,
//   createdBy: uid, servings, notes
//
// /groceryLists/{listId}
//   name, createdBy: uid, createdAt, mealPlanIds[], items[{
//     ingredient, quantity, unit, category, checked, assignedTo: uid|'both'
//   }]
//
// /pantry/{uid}/items/{itemId}
//   name, quantity, unit, category, addedAt, expiresAt
//
// /settings/sites  (single shared doc)
//   sites: [{ id, domain, name, searchPath, enabled, genres[], minRating }]
