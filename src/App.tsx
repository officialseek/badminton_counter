import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import { writeMatchState, subscribeMatchState, isFirebaseEnabled } from './firebase-sync'

export type ServerPlayer = 1 | 2

export interface ScoreboardState {
  name1: string
  name2: string
  score1: number
  score2: number
  set1: number
  set2: number
  /** Vem som servar från start (0-0). */
  serverAtStart: ServerPlayer
  /** Vem som servar nu – den som vann senaste poängen servar nästa boll. */
  currentServer: ServerPlayer
}

const MATCH_ID_STORAGE_KEY = 'badminton-current-match-id'

function getMatchStorageKey(matchId: string): string {
  return `badminton-match-${matchId}`
}

function loadMatchState(matchId: string): ScoreboardState | null {
  try {
    const raw = localStorage.getItem(getMatchStorageKey(matchId))
    if (raw) {
      const data = JSON.parse(raw) as ScoreboardState
      const serverAtStart = data.serverAtStart === 2 ? 2 : 1
      const currentServer = data.currentServer === 2 ? 2 : 1
      return {
        name1: data.name1 ?? '',
        name2: data.name2 ?? '',
        score1: Number(data.score1) || 0,
        score2: Number(data.score2) || 0,
        set1: Number(data.set1) || 0,
        set2: Number(data.set2) || 0,
        serverAtStart,
        currentServer: typeof data.currentServer === 'number' ? currentServer : serverAtStart,
      }
    }
  } catch {
    // ignore
  }
  return null
}

function saveMatchState(matchId: string, state: ScoreboardState): void {
  localStorage.setItem(getMatchStorageKey(matchId), JSON.stringify(state))
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
  if (setWinner) {
    text += `Matchvinnare (set): ${setWinner}\n`
  }
  if (pointWinner && pointWinner !== setWinner) {
    text += `Senaste set (poäng): ${pointWinner}\n`
  }
  if (!setWinner && !pointWinner) {
    text += `Oavgjort.\n`
  }
  text += `\n${'═'.repeat(40)}\n`
  return text
}

function downloadMatch(summary: string): void {
  const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' })
  const date = new Date()
  const filename = `badminton_${date.toISOString().slice(0, 10)}_${Date.now().toString(36)}.txt`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

interface PlayerSideProps {
  label: string
  name: string
  onNameChange: (value: string) => void
  score: number
  onScoreChange: (delta: number) => void
  set: number
  onSetChange: (delta: number) => void
}

function PlayerSide({
  label,
  name,
  onNameChange,
  score,
  onScoreChange,
  set,
  onSetChange,
}: PlayerSideProps) {
  return (
    <div className="side">
      <span className="side-label">{label}</span>
      <input
        type="text"
        className="name-input"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={label}
        maxLength={20}
      />
      <span className="score-display">{score}</span>
      <div className="score-controls">
        <button
          type="button"
          className="btn-score"
          onClick={() => onScoreChange(-1)}
          disabled={score <= 0}
          aria-label="Minska poäng"
        >
          −
        </button>
        <button
          type="button"
          className="btn-score"
          onClick={() => onScoreChange(1)}
          aria-label="Öka poäng"
        >
          +
        </button>
      </div>
      <span className="row-label">Set</span>
      <span className="score-display set-display">{set}</span>
      <div className="score-controls">
        <button
          type="button"
          className="btn-score"
          onClick={() => onSetChange(-1)}
          disabled={set <= 0}
          aria-label="Minska set"
        >
          −
        </button>
        <button
          type="button"
          className="btn-score"
          onClick={() => onSetChange(1)}
          aria-label="Öka set"
        >
          +
        </button>
      </div>
    </div>
  )
}

interface SaveModalProps {
  open: boolean
  summary: string
  onClose: () => void
  onCopy: () => void
  onDownload: () => void
  copyLabel: string
  downloadLabel: string
}

function SaveModal({
  open,
  summary,
  onClose,
  onCopy,
  onDownload,
  copyLabel,
  downloadLabel,
}: SaveModalProps) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal">
        <h2 id="modal-title">Matchresultat</h2>
        <pre>{summary}</pre>
        <div className="modal-buttons">
          <button type="button" className="btn-copy" onClick={onCopy}>
            {copyLabel}
          </button>
          <button type="button" className="btn-save" onClick={onDownload}>
            {downloadLabel}
          </button>
          <button type="button" className="btn-close" onClick={onClose}>
            Stäng
          </button>
        </div>
      </div>
    </div>
  )
}

function ScoreboardDisplay({ matchId }: { matchId: string }) {
  const [state, setState] = useState<ScoreboardState>(() => loadMatchState(matchId) ?? EMPTY_STATE)
  const [mirrored, setMirrored] = useState(false)
  const storageKey = getMatchStorageKey(matchId)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as ScoreboardState)
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  useEffect(() => {
    const unsubscribe = subscribeMatchState(matchId, (newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [matchId])

  const p1Name = state.name1.trim() || 'Spelare 1'
  const p2Name = state.name2.trim() || 'Spelare 2'
  const leftName = mirrored ? p2Name : p1Name
  const rightName = mirrored ? p1Name : p2Name
  const leftScore = mirrored ? state.score2 : state.score1
  const rightScore = mirrored ? state.score1 : state.score2
  const leftSet = mirrored ? state.set2 : state.set1
  const rightSet = mirrored ? state.set1 : state.set2

  const currentServer = state.currentServer === 2 ? 2 : 1
  const leftServes = currentServer === (mirrored ? 2 : 1)

  const hasNoData =
    state.name1 === '' &&
    state.name2 === '' &&
    state.score1 === 0 &&
    state.score2 === 0 &&
    state.set1 === 0 &&
    state.set2 === 0

  const servingName = leftServes ? leftName : rightName

  return (
    <div className="scoreboard-tavla">
      {hasNoData && (
        <p className="scoreboard-waiting">
          {isFirebaseEnabled()
            ? 'Väntar på matchdata från poängräknaren…'
            : 'Väntar på matchdata. Öppna länken på samma enhet som poängräknaren, eller aktivera Firebase för synk mellan enheter.'}
        </p>
      )}
      <div className="scoreboard-board">
        <div className="tavla-side tavla-left">
          <span className="tavla-name">{leftName}</span>
          <span className="tavla-score">{leftScore}</span>
          <span className="tavla-sets">Set: {leftSet}</span>
        </div>
        <span className="tavla-divider" aria-hidden>–</span>
        <div className="tavla-side tavla-right">
          <span className="tavla-name">{rightName}</span>
          <span className="tavla-score">{rightScore}</span>
          <span className="tavla-sets">Set: {rightSet}</span>
        </div>
      </div>
      <div className="tavla-serve">
        <span className="tavla-serve-label">Servar</span>
        <span className="tavla-serve-name">🏸 {servingName}</span>
      </div>
      <button
        type="button"
        className="tavla-mirror"
        onClick={() => setMirrored((m) => !m)}
        aria-pressed={mirrored}
        title={mirrored ? 'Slå av spegling' : 'Spegla tavlan'}
      >
        ⇄
      </button>
    </div>
  )
}

function generateMatchId(): string {
  return crypto.randomUUID?.() ?? `match-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function AppMain() {
  const [matchId, setMatchId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(MATCH_ID_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [name1, setName1] = useState('')
  const [name2, setName2] = useState('')
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [set1, setSet1] = useState(0)
  const [set2, setSet2] = useState(0)
  const [serverAtStart, setServerAtStart] = useState<ServerPlayer>(1)
  const [currentServer, setCurrentServer] = useState<ServerPlayer>(1)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrModalMatchId, setQrModalMatchId] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Kopiera')
  const [downloadLabel, setDownloadLabel] = useState('Ladda ner fil')

  const scoreboardState: ScoreboardState = {
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
    if (matchId) {
      localStorage.setItem(MATCH_ID_STORAGE_KEY, matchId)
      saveMatchState(matchId, scoreboardState)
      writeMatchState(matchId, scoreboardState)
    }
  }, [matchId, name1, name2, score1, score2, set1, set2, serverAtStart, currentServer])

  const displayUrl =
    typeof window !== 'undefined' && (qrModalMatchId ?? matchId)
      ? `${window.location.origin}${window.location.pathname || '/'}?display=1&match=${encodeURIComponent(qrModalMatchId ?? matchId ?? '')}`
      : ''

  useEffect(() => {
    if (!qrModalOpen || !(qrModalMatchId ?? matchId)) return
    const url = `${window.location.origin}${window.location.pathname || '/'}?display=1&match=${encodeURIComponent(qrModalMatchId ?? matchId ?? '')}`
    QRCode.toDataURL(url, { width: 260, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
  }, [qrModalOpen, qrModalMatchId, matchId])

  const summary = getMatchSummary(name1, name2, score1, score2, set1, set2, serverAtStart)

  const handleSwap = () => {
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
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopyLabel('Kopierat!')
      setTimeout(() => setCopyLabel('Kopiera'), 1500)
    })
  }

  const handleDownload = () => {
    downloadMatch(summary)
    setDownloadLabel('Nedladdad!')
    setTimeout(() => setDownloadLabel('Ladda ner fil'), 1500)
  }

  return (
    <>
      <h1>🏸 Badminton Poängräknare</h1>

      <div className="court">
        <PlayerSide
          label="Spelare 1"
          name={name1}
          onNameChange={setName1}
          score={score1}
          onScoreChange={(d) => {
            setScore1((s) => Math.max(0, s + d))
            if (d > 0) setCurrentServer(1)
            else if (d < 0) setCurrentServer(2)
          }}
          set={set1}
          onSetChange={(d) => setSet1((s) => Math.max(0, s + d))}
        />

        <div className="court-center">
          <span className="vs">VS</span>
          <button
            type="button"
            className="btn-swap"
            onClick={handleSwap}
            aria-label="Byt sida"
          >
            ⇄ Byt sida
          </button>
          <div className="server-choice">
            <span className="server-choice-label">Servar från start</span>
            <div className="server-choice-buttons">
              <button
                type="button"
                className={`btn-server ${currentServer === 1 ? 'active' : ''}`}
                onClick={() => {
                  setCurrentServer(1)
                  if (score1 + score2 === 0) setServerAtStart(1)
                }}
                aria-pressed={currentServer === 1}
              >
                1
              </button>
              <button
                type="button"
                className={`btn-server ${currentServer === 2 ? 'active' : ''}`}
                onClick={() => {
                  setCurrentServer(2)
                  if (score1 + score2 === 0) setServerAtStart(2)
                }}
                aria-pressed={currentServer === 2}
              >
                2
              </button>
            </div>
            <span className="server-choice-name" aria-live="polite">
              {currentServer === 1 ? (name1.trim() || 'Spelare 1') : (name2.trim() || 'Spelare 2')}
            </span>
            {score1 + score2 > 0 && (
              <span className="server-choice-locked">Började serva: {serverAtStart === 1 ? (name1.trim() || 'Spelare 1') : (name2.trim() || 'Spelare 2')}</span>
            )}
          </div>
        </div>

        <PlayerSide
          label="Spelare 2"
          name={name2}
          onNameChange={setName2}
          score={score2}
          onScoreChange={(d) => {
            setScore2((s) => Math.max(0, s + d))
            if (d > 0) setCurrentServer(2)
            else if (d < 0) setCurrentServer(1)
          }}
          set={set2}
          onSetChange={(d) => setSet2((s) => Math.max(0, s + d))}
        />
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn-swap"
          onClick={() => {
            const id = matchId || generateMatchId()
            if (!matchId) setMatchId(id)
            setQrModalMatchId(id)
            setQrDataUrl(null)
            setQrModalOpen(true)
          }}
        >
          📺 Visa QR för poängvisare
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={() => {
            const base = `${window.location.origin}${window.location.pathname || '/'}`
            window.location.href = `${base}?display=1`
          }}
        >
          📷 Skanna QR – öppna som poängvisare
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={() => setSaveModalOpen(true)}
        >
          Spara match
        </button>
        <span className="save-info">
          Ladda ner en fil med matchresultat eller kopiera till urklipp
        </span>
        <button
          type="button"
          className="btn-swap save-info-link"
          onClick={() => {
            setMatchId(null)
            setQrModalMatchId(null)
            setQrDataUrl(null)
            setName1('')
            setName2('')
            setScore1(0)
            setScore2(0)
            setSet1(0)
            setSet2(0)
            setServerAtStart(1)
            setCurrentServer(1)
            setQrModalOpen(false)
            try {
              localStorage.removeItem(MATCH_ID_STORAGE_KEY)
            } catch {
              // ignore
            }
          }}
        >
          Starta ny match
        </button>
      </div>

      {qrModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQrModalOpen(false)
              setQrModalMatchId(null)
              setQrDataUrl(null)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div className="modal qr-modal">
            <h2 id="qr-modal-title">Poängvisare – koppla enhet till denna match</h2>
            <p className="qr-modal-text">
              Skanna QR-koden med den enhet som ska visa poängen. Den enheten är då kopplad till denna match.
            </p>
            <div className="qr-modal-image-wrap">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR-kod för poängvisare" className="qr-modal-image" />
              ) : (
                <span className="qr-modal-loading">Laddar QR-kod…</span>
              )}
            </div>
            <div className="qr-modal-url-wrap">
              <input
                type="text"
                readOnly
                className="qr-modal-url"
                value={displayUrl || ''}
                aria-label="Länk till poängvisare"
              />
              <button
                type="button"
                className="btn-copy"
                onClick={() => {
                  if (displayUrl) navigator.clipboard.writeText(displayUrl)
                }}
              >
                Kopiera länk
              </button>
            </div>
            <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setQrModalOpen(false)
                  setQrModalMatchId(null)
                  setQrDataUrl(null)
                }}
              >
              Stäng
            </button>
          </div>
        </div>
      )}

      <SaveModal
        open={saveModalOpen}
        summary={summary}
        onClose={() => setSaveModalOpen(false)}
        onCopy={handleCopy}
        onDownload={handleDownload}
        copyLabel={copyLabel}
        downloadLabel={downloadLabel}
      />
    </>
  )
}

const QR_READER_ID = 'badminton-qr-reader'

function getMatchIdFromUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    return url.searchParams.get('match')
  } catch {
    return null
  }
}

function DisplayScanConnect() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (!scanning) return
    setError(null)
    const el = document.getElementById(QR_READER_ID)
    if (!el) return

    const scanner = new Html5Qrcode(QR_READER_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const matchId = getMatchIdFromUrl(decodedText)
          if (matchId) {
            scanner.stop().then(() => {
              scannerRef.current = null
              setScanning(false)
              const base = `${window.location.origin}${window.location.pathname || '/'}`
              window.location.href = `${base}?display=1&match=${encodeURIComponent(matchId)}`
            }).catch(() => {
              setScanning(false)
              window.location.href = `${window.location.pathname || '/'}?display=1&match=${encodeURIComponent(matchId)}`
            })
          }
        },
        () => {}
      )
      .catch((err: Error) => {
        setError(err?.message ?? 'Kunde inte starta kameran')
        setScanning(false)
        scannerRef.current = null
      })

    return () => {
      scannerRef.current = null
      scanner.stop().catch(() => {})
    }
  }, [scanning])

  const handleCancel = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScanning(false)
    setError(null)
  }

  return (
    <div className="scoreboard-display scoreboard-connect">
      <h1 className="scoreboard-title">🏸 Poängvisare</h1>
      <p className="scoreboard-error-text">
        Koppla denna enhet till en match genom att skanna QR-koden som visas i poängräknaren.
      </p>

      {!scanning ? (
        <button
          type="button"
          className="btn-save scan-connect-btn"
          onClick={() => setScanning(true)}
        >
          📷 Skanna QR för att koppla till match
        </button>
      ) : (
        <div className="scan-area">
          <div id={QR_READER_ID} className="qr-reader-container" />
          {error && <p className="scoreboard-error-text scan-error">{error}</p>}
          <button type="button" className="btn-close scan-cancel-btn" onClick={handleCancel}>
            Avbryt
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const isDisplayMode = params.get('display') === '1'
  const matchId = params.get('match') ?? ''

  if (isDisplayMode) {
    if (!matchId) return <DisplayScanConnect />
    return <ScoreboardDisplay matchId={matchId} />
  }
  return <AppMain />
}
