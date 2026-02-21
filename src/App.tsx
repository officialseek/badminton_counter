import { useState } from 'react'

function getMatchSummary(
  name1: string,
  name2: string,
  score1: number,
  score2: number,
  set1: number,
  set2: number
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
  let text = `🏸 BADMINTON MATCH\n`
  text += `${'═'.repeat(40)}\n\n`
  text += `Datum: ${dateStr}\n\n`
  text += `Set:   ${p1}  ${set1} – ${set2}  ${p2}\n`
  text += `Poäng: ${p1}  ${score1} – ${score2}  ${p2}\n\n`
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

export default function App() {
  const [name1, setName1] = useState('')
  const [name2, setName2] = useState('')
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [set1, setSet1] = useState(0)
  const [set2, setSet2] = useState(0)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Kopiera')
  const [downloadLabel, setDownloadLabel] = useState('Ladda ner fil')

  const summary = getMatchSummary(name1, name2, score1, score2, set1, set2)

  const handleSwap = () => {
    const n1 = name1
    const n2 = name2
    setName1(n2)
    setName2(n1)
    setScore1(score2)
    setScore2(score1)
    setSet1(set2)
    setSet2(set1)
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
          onScoreChange={(d) => setScore1((s) => Math.max(0, s + d))}
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
        </div>

        <PlayerSide
          label="Spelare 2"
          name={name2}
          onNameChange={setName2}
          score={score2}
          onScoreChange={(d) => setScore2((s) => Math.max(0, s + d))}
          set={set2}
          onSetChange={(d) => setSet2((s) => Math.max(0, s + d))}
        />
      </div>

      <div className="actions">
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
      </div>

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
