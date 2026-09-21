# Cooking 4 2

Jacob & Caroline's private meal planning app — discover recipes, plan meals, generate grocery lists, track two pantries, and cook step by step.

**Live app:** `https://jacobseither-home.github.io/cooking-4-2/`

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth + DB | Firebase (Google Auth + Firestore) |
| Hosting | GitHub Pages (auto-deployed via Actions) |
| Recipe proxy | Cloudflare Worker (free tier) |
| PWA | vite-plugin-pwa + Workbox |

---

## First-time setup (do this once)

### 1 — Create the GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Sign in as **JacobSeither-Home**
3. Repository name: `cooking-4-2`
4. Set to **Private** (recommended) or Public
5. Leave everything else default → **Create repository**

### 2 — Push this code

On your computer (in the folder where you put these files):

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/JacobSeither-Home/cooking-4-2.git
git push -u origin main
```

### 3 — Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Source: **GitHub Actions**
3. Save

### 4 — Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `cooking-4-2`
3. Disable Google Analytics (optional) → **Create project**

**Enable Google Sign-In:**
- Left sidebar → **Authentication → Sign-in method**
- Enable **Google**
- Add your authorized domain: `jacobseither-home.github.io`

**Create Firestore database:**
- Left sidebar → **Firestore Database → Create database**
- Choose **production mode** → pick a region (us-central1 is fine)

**Paste these Firestore Security Rules** (Firestore → Rules tab):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only signed-in users can read/write
    function isAuth() { return request.auth != null; }

    match /users/{uid} {
      allow read, write: if isAuth() && request.auth.uid == uid;
      allow read: if isAuth();  // allow each user to read the other's profile
    }
    match /recipes/{doc}     { allow read, write: if isAuth(); }
    match /mealPlans/{doc}   { allow read, write: if isAuth(); }
    match /groceryLists/{doc}{ allow read, write: if isAuth(); }
    match /pantry/{house}/items/{item} { allow read, write: if isAuth(); }
    match /settings/{doc}    { allow read, write: if isAuth(); }
  }
}
```

**Get your config values:**
- Left sidebar → **Project Settings (⚙️) → Your apps → Add app → Web**
- App nickname: `cooking-4-2`
- Copy the `firebaseConfig` object values

### 5 — Set up the Cloudflare Worker

1. Sign up free at [dash.cloudflare.com](https://dash.cloudflare.com) if you don't have an account
2. Install wrangler: `npm install -g wrangler`
3. Log in: `wrangler login`
4. Deploy the worker:
   ```bash
   cd worker
   npm install
   npx wrangler deploy
   ```
5. Copy the worker URL from the output (looks like `https://cooking-4-2-worker.jacobseither-home.workers.dev`)

### 6 — Add secrets to GitHub Actions

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add each of these (one at a time):

| Secret name | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase config |
| `VITE_FIREBASE_APP_ID` | Firebase config |
| `VITE_WORKER_URL` | Cloudflare Worker URL from step 5 |

### 7 — Trigger the first deploy

Push any commit to `main` (or go to **Actions → Deploy to GitHub Pages → Run workflow**).

After ~2 minutes your app is live at `https://jacobseither-home.github.io/cooking-4-2/`

---

## Installing on iPhone (iOS)

1. Open `https://jacobseither-home.github.io/cooking-4-2/` in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add** — it now behaves like a native app

---

## Local development

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Start dev server
npm run dev
# → App at http://localhost:5173/cooking-4-2/

# In another terminal, run the worker locally
cd worker && npx wrangler dev
# → Worker at http://localhost:8787
# Set VITE_WORKER_URL=http://localhost:8787 in .env for local dev
```

---

## Adding / updating recipes

- **Discover tab** → search bar searches your approved sites
- Paste any recipe URL with the 🔗 button to import directly
- Imported recipes are parsed via the Cloudflare Worker (extracts structured data)
- NYT Cooking recipes require you to be subscribed — the parser works on pages you can view in your browser

## Updating recipe sites

**Settings tab → Recipe Sites**
- Toggle sites on/off
- Adjust genre filters and minimum ratings per site
- Add any site with `+ button`: name, domain, and search URL path

## How ingredient recommendations work

When you have meals in your plan, the **Discover** page shows a "Efficient picks" section at the top — these are your saved recipes ranked by how many ingredients they share with what you're already making. Each card shows how many ingredients overlap, so you can see at a glance which extra meal would cost the fewest new grocery items.

---

## Updating the app

Any `git push` to `main` auto-deploys in ~2 minutes. The PWA will prompt users to refresh when a new version is available.
