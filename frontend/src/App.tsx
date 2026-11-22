import { useState } from 'react'
import './App.css'
import LibraryView from './LibraryView'
import MethodView from './MethodView'
import PrintView from './PrintView'

type Tab = 'print' | 'library' | 'method'
const tabs: { value: Tab; label: string }[] = [
  { value: 'print', label: 'Print' },
  { value: 'library', label: 'Library' },
  { value: 'method', label: 'Method' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('print')
  const [saved, setSaved] = useState(0)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Mood Transfer</div>
        <nav className="tabs" aria-label="Views">
          {tabs.map((t) => (
            <button key={t.value} className={tab === t.value ? 'is-on' : ''} aria-current={tab === t.value ? 'page' : undefined} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* print view hamesha mounted rehta hai taake tab badalne pe run gum na ho */}
      <div hidden={tab !== 'print'}>
        <PrintView onSaved={() => setSaved((n) => n + 1)} />
      </div>
      {tab === 'library' && <LibraryView refreshKey={saved} />}
      {tab === 'method' && <MethodView />}

      <footer className="footer">
        <span>Muhammad Shuja Jamal, 23L-3024</span>
        <span>Hassaan bin Saqib, 23L-3039</span>
        <span>CS4055 Digital Image Processing, Fall 2026</span>
      </footer>
    </div>
  )
}
