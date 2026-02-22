/**
 * Realtidssynk via Firebase (samma som webbappen).
 * Sätt EXPO_PUBLIC_FIREBASE_API_KEY och EXPO_PUBLIC_FIREBASE_DATABASE_URL i .env (eller app.config.js extra).
 */
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, type Database } from 'firebase/database'
import Constants from 'expo-constants'
import type { ScoreboardState } from './App'

const extra = Constants.expoConfig?.extra as {
  firebaseApiKey?: string
  firebaseDatabaseUrl?: string
} | undefined

const apiKey = extra?.firebaseApiKey ?? (process.env.EXPO_PUBLIC_FIREBASE_API_KEY as string | undefined)
const databaseURL = extra?.firebaseDatabaseUrl ?? (process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL as string | undefined)

let db: Database | null = null

if (apiKey && databaseURL) {
  try {
    const app = initializeApp({ apiKey, databaseURL })
    db = getDatabase(app)
  } catch {
    db = null
  }
}

export function isFirebaseEnabled(): boolean {
  return db !== null
}

const MATCHES_PATH = 'matches'

export function writeMatchState(matchId: string, state: ScoreboardState): void {
  if (!db) return
  const matchRef = ref(db, `${MATCHES_PATH}/${matchId}`)
  set(matchRef, state).catch(() => {
    // Tyst fel
  })
}

function parseState(data: unknown): ScoreboardState | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  return {
    name1: typeof d.name1 === 'string' ? d.name1 : '',
    name2: typeof d.name2 === 'string' ? d.name2 : '',
    score1: Number(d.score1) || 0,
    score2: Number(d.score2) || 0,
    set1: Number(d.set1) || 0,
    set2: Number(d.set2) || 0,
    serverAtStart: d.serverAtStart === 2 ? 2 : 1,
    currentServer: d.currentServer === 2 ? 2 : 1,
  }
}

/**
 * Prenumerera på matchstate från Firebase. Returnerar avprenumereringsfunktion.
 */
export function subscribeMatchState(
  matchId: string,
  onUpdate: (state: ScoreboardState) => void
): () => void {
  if (!db) return () => {}
  const matchRef = ref(db, `${MATCHES_PATH}/${matchId}`)
  const unsubscribe = onValue(
    matchRef,
    (snapshot) => {
      const state = parseState(snapshot.val())
      if (state) onUpdate(state)
    },
    () => {}
  )
  return unsubscribe
}
