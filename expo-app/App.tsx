import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'
import { CameraView, useCameraPermissions } from 'expo-camera'
import QRCode from 'qrcode'
import { StatusBar } from 'expo-status-bar'
import { writeMatchState, subscribeMatchState, isFirebaseEnabled } from './firebase-sync'

const MATCH_ID_KEY = 'badminton-current-match-id'
const getMatchKey = (id: string) => `badminton-match-${id}`

export type ServerPlayer = 1 | 2

export interface ScoreboardState {
  name1: string
  name2: string
  score1: number
  score2: number
  set1: number
  set2: number
  serverAtStart: ServerPlayer
  currentServer: ServerPlayer
}

const EMPTY_STATE: ScoreboardState = {
  name1: '',
  name2: '',
  score1: 0,
  score2: 0,
  set1: 0,
  set2: 0,
  serverAtStart: 1,
  currentServer: 1,
}

async function loadMatchState(matchId: string): Promise<ScoreboardState | null> {
  try {
    const raw = await AsyncStorage.getItem(getMatchKey(matchId))
    if (!raw) return null
    const data = JSON.parse(raw) as ScoreboardState
    return {
      name1: data.name1 ?? '',
      name2: data.name2 ?? '',
      score1: Number(data.score1) || 0,
      score2: Number(data.score2) || 0,
      set1: Number(data.set1) || 0,
      set2: Number(data.set2) || 0,
      serverAtStart: data.serverAtStart === 2 ? 2 : 1,
      currentServer: data.currentServer === 2 ? 2 : 1,
    }
  } catch {
    return null
  }
}

async function saveMatchState(matchId: string, state: ScoreboardState): Promise<void> {
  await AsyncStorage.setItem(getMatchKey(matchId), JSON.stringify(state))
}

function getMatchSummary(
  name1: string,
  name2: string,
  score1: number,
  score2: number,
  set1: number,
  set2: number,
  serverAtStart: ServerPlayer
): string {
  const date = new Date()
  const dateStr = date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p1 = name1.trim() || 'Spelare 1'
  const p2 = name2.trim() || 'Spelare 2'
  const setWinner = set1 > set2 ? p1 : set2 > set1 ? p2 : null
  const pointWinner = score1 > score2 ? p1 : score2 > score1 ? p2 : null
  const startedServing = serverAtStart === 1 ? p1 : p2
  let text = `🏸 BADMINTON MATCH\n`
  text += `${'═'.repeat(40)}\n\n`
  text += `Datum: ${dateStr}\n\n`
  text += `Set:   ${p1}  ${set1} – ${set2}  ${p2}\n`
  text += `Poäng: ${p1}  ${score1} – ${score2}  ${p2}\n`
  text += `Servar från start: ${startedServing}\n\n`
  if (setWinner) text += `Matchvinnare (set): ${setWinner}\n`
  if (pointWinner && pointWinner !== setWinner) text += `Senaste set (poäng): ${pointWinner}\n`
  if (!setWinner && !pointWinner) text += `Oavgjort.\n`
  text += `\n${'═'.repeat(40)}\n`
  return text
}

function generateMatchId(): string {
  return 'match-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11)
}

function parseMatchIdFromScan(data: string): string | null {
  try {
    if (data.startsWith('http')) {
      const url = new URL(data)
      return url.searchParams.get('match')
    }
    if (data.startsWith('match-') || data.length > 20) return data
    return null
  } catch {
    return null
  }
}

type Role = 'keeper' | 'scan' | 'display'

export default function App() {
  const [role, setRole] = useState<Role>('keeper')
  const [matchId, setMatchId] = useState<string | null>(null)
  const [matchIdForDisplay, setMatchIdForDisplay] = useState<string | null>(null)
  const [name1, setName1] = useState('')
  const [name2, setName2] = useState('')
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [set1, setSet1] = useState(0)
  const [set2, setSet2] = useState(0)
  const [serverAtStart, setServerAtStart] = useState<ServerPlayer>(1)
  const [currentServer, setCurrentServer] = useState<ServerPlayer>(1)
  const [displayState, setDisplayState] = useState<ScoreboardState>(EMPTY_STATE)
  const [mirrored, setMirrored] = useState(false)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [qrModalMatchId, setQrModalMatchId] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const { width } = useWindowDimensions()

  const state: ScoreboardState = {
    name1,
    name2,
    score1,
    score2,
    set1,
    set2,
    serverAtStart,
    currentServer,
  }

  useEffect(() => {
    if (!matchId) return
    AsyncStorage.setItem(MATCH_ID_KEY, matchId)
    saveMatchState(matchId, state)
    if (isFirebaseEnabled()) writeMatchState(matchId, state)
  }, [matchId, name1, name2, score1, score2, set1, set2, serverAtStart, currentServer])

  useEffect(() => {
    AsyncStorage.getItem(MATCH_ID_KEY).then(async (v) => {
      if (!v) return
      setMatchId(v)
      const s = await loadMatchState(v)
      if (s) {
        setName1(s.name1)
        setName2(s.name2)
        setScore1(s.score1)
        setScore2(s.score2)
        setSet1(s.set1)
        setSet2(s.set2)
        setServerAtStart(s.serverAtStart)
        setCurrentServer(s.currentServer)
      }
    })
  }, [])

  const summary = getMatchSummary(name1, name2, score1, score2, set1, set2, serverAtStart)

  const handleSwap = useCallback(() => {
    const n1 = name1
    const n2 = name2
    setName1(n2)
    setName2(n1)
    setScore1(0)
    setScore2(0)
    setSet1(set2)
    setSet2(set1)
    setServerAtStart((s) => (s === 1 ? 2 : 1))
    setCurrentServer((s) => (s === 1 ? 2 : 1))
  }, [name1, name2, set1, set2])

  const openQrModal = useCallback(() => {
    const id = matchId || generateMatchId()
    if (!matchId) setMatchId(id)
    setQrModalMatchId(id)
    setQrDataUrl(null)
    setQrModalVisible(true)
  }, [matchId])

  useEffect(() => {
    if (!qrModalVisible || !qrModalMatchId) return
    QRCode.toDataURL(qrModalMatchId, { width: 260, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [qrModalVisible, qrModalMatchId])

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const id = parseMatchIdFromScan(data)
      if (id) {
        setMatchIdForDisplay(id)
        setRole('display')
      }
    },
    []
  )

  useEffect(() => {
    if (role !== 'display' || !matchIdForDisplay) return
    if (isFirebaseEnabled()) {
      const unsubscribe = subscribeMatchState(matchIdForDisplay, setDisplayState)
      return unsubscribe
    }
    const interval = setInterval(async () => {
      const s = await loadMatchState(matchIdForDisplay)
      if (s) setDisplayState(s)
    }, 1000)
    return () => clearInterval(interval)
  }, [role, matchIdForDisplay])

  useEffect(() => {
    if (role === 'display' && matchIdForDisplay && !isFirebaseEnabled()) {
      loadMatchState(matchIdForDisplay).then((s) => s && setDisplayState(s))
    }
  }, [role, matchIdForDisplay])

  if (role === 'scan') {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {!permission?.granted ? (
          <View style={styles.scanPlaceholder}>
            <Text style={styles.scanText}>Kamera behövs för att skanna QR-kod</Text>
            <Pressable style={styles.btnPrimary} onPress={requestPermission}>
              <Text style={styles.btnPrimaryText}>Tillåt kamera</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => setRole('keeper')}>
              <Text style={styles.btnSecondaryText}>Tillbaka</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <View style={styles.scanOverlay}>
              <Pressable style={styles.btnSecondary} onPress={() => setRole('keeper')}>
                <Text style={styles.btnSecondaryText}>Avbryt</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    )
  }

  if (role === 'display') {
    const s = displayState
    const p1 = s.name1.trim() || 'Spelare 1'
    const p2 = s.name2.trim() || 'Spelare 2'
    const leftName = mirrored ? p2 : p1
    const rightName = mirrored ? p1 : p2
    const leftScore = mirrored ? s.score2 : s.score1
    const rightScore = mirrored ? s.score1 : s.score2
    const leftSet = mirrored ? s.set2 : s.set1
    const rightSet = mirrored ? s.set1 : s.set2
    const servingName = s.currentServer === (mirrored ? 2 : 1) ? leftName : rightName
    const hasNoData = !s.name1 && !s.name2 && s.score1 === 0 && s.score2 === 0 && s.set1 === 0 && s.set2 === 0

    return (
      <View style={[styles.screen, styles.tavlaScreen]}>
        <StatusBar style="light" />
        {hasNoData && (
          <Text style={styles.waitingText}>Väntar på matchdata från poängräknaren.</Text>
        )}
        <View style={styles.board}>
          <View style={styles.tavlaSide}>
            <Text style={styles.tavlaName} numberOfLines={1}>{leftName}</Text>
            <Text style={styles.tavlaScore}>{leftScore}</Text>
            <Text style={styles.tavlaSets}>Set: {leftSet}</Text>
          </View>
          <Text style={styles.tavlaDivider}>–</Text>
          <View style={styles.tavlaSide}>
            <Text style={styles.tavlaName} numberOfLines={1}>{rightName}</Text>
            <Text style={styles.tavlaScore}>{rightScore}</Text>
            <Text style={styles.tavlaSets}>Set: {rightSet}</Text>
          </View>
        </View>
        <View style={styles.serveRow}>
          <Text style={styles.serveLabel}>Servar</Text>
          <Text style={styles.serveName}>🏸 {servingName}</Text>
        </View>
        <Pressable
          style={styles.mirrorBtn}
          onPress={() => setMirrored((m) => !m)}
        >
          <Text style={styles.mirrorBtnText}>⇄</Text>
        </Pressable>
        <Pressable style={styles.backToKeeper} onPress={() => { setRole('keeper'); setMatchIdForDisplay(null) }}>
          <Text style={styles.btnSecondaryText}>Tillbaka till poängräknare</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.keeperScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🏸 Badminton Poängräknare</Text>

        <View style={styles.court}>
          <View style={styles.side}>
            <Text style={styles.sideLabel}>Spelare 1</Text>
            <TextInput
              style={styles.nameInput}
              value={name1}
              onChangeText={setName1}
              placeholder="Namn 1"
              placeholderTextColor="#94a3b8"
              maxLength={20}
            />
            <Text style={styles.scoreDisplay}>{score1}</Text>
            <View style={styles.scoreControls}>
              <Pressable style={[styles.btnScore, score1 <= 0 && styles.btnDisabled]} onPress={() => { setScore1((s) => Math.max(0, s - 1)); if (score1 > 0) setCurrentServer(2) }}>
                <Text style={styles.btnScoreText}>−</Text>
              </Pressable>
              <Pressable style={styles.btnScore} onPress={() => { setScore1((s) => s + 1); setCurrentServer(1) }}>
                <Text style={styles.btnScoreText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.rowLabel}>Set</Text>
            <Text style={[styles.scoreDisplay, styles.setDisplay]}>{set1}</Text>
            <View style={styles.scoreControls}>
              <Pressable style={[styles.btnScore, set1 <= 0 && styles.btnDisabled]} onPress={() => setSet1((s) => Math.max(0, s - 1))}>
                <Text style={styles.btnScoreText}>−</Text>
              </Pressable>
              <Pressable style={styles.btnScore} onPress={() => setSet1((s) => s + 1)}>
                <Text style={styles.btnScoreText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.center}>
            <Text style={styles.vs}>VS</Text>
            <Pressable style={styles.btnSwap} onPress={handleSwap}>
              <Text style={styles.btnSwapText}>⇄ Byt sida</Text>
            </Pressable>
            <View style={styles.serverChoice}>
              <Text style={styles.serverChoiceLabel}>Servar från start</Text>
              <View style={styles.serverChoiceRow}>
                <Pressable style={[styles.btnServer, currentServer === 1 && styles.btnServerActive]} onPress={() => { setCurrentServer(1); if (score1 + score2 === 0) setServerAtStart(1) }}>
                  <Text style={[styles.btnServerText, currentServer === 1 && styles.btnServerActiveText]}>1</Text>
                </Pressable>
                <Pressable style={[styles.btnServer, currentServer === 2 && styles.btnServerActive]} onPress={() => { setCurrentServer(2); if (score1 + score2 === 0) setServerAtStart(2) }}>
                  <Text style={[styles.btnServerText, currentServer === 2 && styles.btnServerActiveText]}>2</Text>
                </Pressable>
              </View>
              <Text style={styles.serverChoiceName} numberOfLines={1}>
                {currentServer === 1 ? (name1 || 'Spelare 1') : (name2 || 'Spelare 2')}
              </Text>
              {score1 + score2 > 0 && (
                <Text style={styles.serverChoiceLocked} numberOfLines={1}>
                  Började serva: {serverAtStart === 1 ? (name1 || 'Spelare 1') : (name2 || 'Spelare 2')}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.side}>
            <Text style={styles.sideLabel}>Spelare 2</Text>
            <TextInput
              style={styles.nameInput}
              value={name2}
              onChangeText={setName2}
              placeholder="Namn 2"
              placeholderTextColor="#94a3b8"
              maxLength={20}
            />
            <Text style={styles.scoreDisplay}>{score2}</Text>
            <View style={styles.scoreControls}>
              <Pressable style={[styles.btnScore, score2 <= 0 && styles.btnDisabled]} onPress={() => { setScore2((s) => Math.max(0, s - 1)); if (score2 > 0) setCurrentServer(1) }}>
                <Text style={styles.btnScoreText}>−</Text>
              </Pressable>
              <Pressable style={styles.btnScore} onPress={() => { setScore2((s) => s + 1); setCurrentServer(2) }}>
                <Text style={styles.btnScoreText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.rowLabel}>Set</Text>
            <Text style={[styles.scoreDisplay, styles.setDisplay]}>{set2}</Text>
            <View style={styles.scoreControls}>
              <Pressable style={[styles.btnScore, set2 <= 0 && styles.btnDisabled]} onPress={() => setSet2((s) => Math.max(0, s - 1))}>
                <Text style={styles.btnScoreText}>−</Text>
              </Pressable>
              <Pressable style={styles.btnScore} onPress={() => setSet2((s) => s + 1)}>
                <Text style={styles.btnScoreText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable style={styles.btnSwap} onPress={() => setRole('scan')}>
          <Text style={styles.btnSwapText}>📷 Skanna QR – öppna som poängvisare</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={openQrModal}>
          <Text style={styles.btnPrimaryText}>📺 Visa QR för poängvisare</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={() => setSaveModalVisible(true)}>
          <Text style={styles.btnPrimaryText}>Spara match</Text>
        </Pressable>
        <Pressable
          style={styles.btnSecondary}
          onPress={() => {
            setMatchId(null)
            setQrModalMatchId(null)
            setQrDataUrl(null)
            setQrModalVisible(false)
            setName1('')
            setName2('')
            setScore1(0)
            setScore2(0)
            setSet1(0)
            setSet2(0)
            setServerAtStart(1)
            setCurrentServer(1)
            AsyncStorage.removeItem(MATCH_ID_KEY)
          }}
        >
          <Text style={styles.btnSecondaryText}>Starta ny match</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={qrModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { setQrModalVisible(false); setQrModalMatchId(null); setQrDataUrl(null) }}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Poängvisare – koppla enhet</Text>
            <Text style={styles.modalText}>Skanna QR-koden med enheten som ska visa poängen.</Text>
            <View style={styles.qrImageContainer}>
              {qrDataUrl ? (
                <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <Text style={styles.qrLoadingText}>Laddar QR-kod…</Text>
              )}
            </View>
            <Text style={styles.matchIdText} numberOfLines={1}>{qrModalMatchId || matchId}</Text>
            <Pressable style={styles.btnPrimary} onPress={() => { setQrModalVisible(false); setQrModalMatchId(null); setQrDataUrl(null) }}>
              <Text style={styles.btnPrimaryText}>Stäng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={saveModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSaveModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Matchresultat</Text>
            <ScrollView style={styles.summaryScroll}>
              <Text style={styles.summaryText}>{summary}</Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={styles.btnPrimary} onPress={async () => { await Clipboard.setStringAsync(summary); setSaveModalVisible(false) }}>
                <Text style={styles.btnPrimaryText}>Kopiera</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>Stäng</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const colors = {
  bg: '#1a472a',
  card: 'rgba(45, 90, 61, 0.6)',
  accent: '#f59e0b',
  text: '#f8fafc',
  muted: '#94a3b8',
  border: 'rgba(255,255,255,0.12)',
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  keeperScroll: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  court: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  sideLabel: { fontSize: 12, color: colors.muted, letterSpacing: 1 },
  nameInput: {
    width: '100%',
    maxWidth: 140,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreDisplay: { fontSize: 36, fontWeight: '700', color: colors.accent },
  setDisplay: { fontSize: 22 },
  rowLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  scoreControls: { flexDirection: 'row', gap: 8 },
  btnScore: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnScoreText: { fontSize: 24, fontWeight: '700', color: colors.bg },
  btnDisabled: { opacity: 0.5 },
  center: { alignItems: 'center', paddingHorizontal: 8 },
  vs: { fontSize: 14, fontWeight: '600', color: colors.muted },
  btnSwap: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  btnSwapText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  serverChoice: { alignItems: 'center', marginTop: 8 },
  serverChoiceLabel: { fontSize: 10, color: colors.muted, letterSpacing: 0.5 },
  serverChoiceRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnServer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnServerText: { color: colors.muted, fontWeight: '600' },
  btnServerActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnServerActiveText: { color: colors.bg },
  serverChoiceName: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 4, maxWidth: 120 },
  serverChoiceLocked: { fontSize: 10, color: colors.muted, marginTop: 2, maxWidth: 120 },
  btnPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.accent,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSecondaryText: { color: colors.muted, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10 },
  modalText: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  qrImageContainer: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: { width: 220, height: 220, borderRadius: 12 },
  qrLoadingText: { fontSize: 14, color: colors.muted },
  matchIdText: { fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 12 },
  summaryScroll: { maxHeight: 200, marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 12 },
  summaryText: { fontFamily: 'monospace', fontSize: 12, color: colors.text },
  modalButtons: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  scanPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scanText: { color: colors.text, marginBottom: 16, textAlign: 'center' },
  scanOverlay: { position: 'absolute', top: 50, left: 20, right: 20, alignItems: 'center' },
  tavlaScreen: { justifyContent: 'center', paddingVertical: 24 },
  waitingText: { color: colors.muted, textAlign: 'center', marginBottom: 12, fontSize: 14 },
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tavlaSide: { flex: 1, alignItems: 'center' },
  tavlaName: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
  tavlaScore: { fontSize: 56, fontWeight: '700', color: colors.accent },
  tavlaSets: { fontSize: 16, fontWeight: '600', color: colors.muted, marginTop: 8 },
  tavlaDivider: { fontSize: 32, color: colors.muted, marginHorizontal: 12 },
  serveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serveLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  serveName: { fontSize: 18, fontWeight: '600', color: colors.accent },
  mirrorBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorBtnText: { fontSize: 20, color: colors.muted },
  backToKeeper: { marginTop: 24, padding: 12 },
})
