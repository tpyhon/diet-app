import { useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Home, UtensilsCrossed, Footprints,
  Dumbbell, Scale, Bot, LogOut, UserCircle
} from 'lucide-react'
import Dashboard    from './pages/Dashboard'
import MealPage     from './pages/MealPage'
import WeightPage   from './pages/WeightPage'
import AiPage       from './pages/AiPage'
import TrainingPage from './pages/TrainingPage'
import WalkingPage  from './pages/WalkingPage'
import LoginPage    from './pages/LoginPage'
import ProfilePage  from './pages/ProfilePage'

// ───── ナビ定義（icon は全てコンポーネント統一） ─────

const navItems = [
  { to: '/',         icon: Home,            label: 'ホーム'       },
  { to: '/meal',     icon: UtensilsCrossed, label: '食事'         },
  { to: '/walking',  icon: Footprints,      label: 'ウォーク'     },
  { to: '/training', icon: Dumbbell,        label: '筋トレ'       },
  { to: '/weight',   icon: Scale,           label: '体重'         },
  { to: '/ai',       icon: Bot,             label: 'AI'           },
  { to: '/profile',  icon: UserCircle,      label: 'プロフィール' },
]

export default function App() {
  // ── api.ts と同じキー名 "token" を使用 ──
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  )
  const [user, setUser] = useState<{ username: string; display_name?: string } | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  )

  const handleLogin = (
    newToken: string,
    newUser: { username: string; display_name?: string }
  ) => {
    setToken(newToken)
    setUser(newUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')       // ← "token" に統一
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* ヘッダー */}
      <header className="bg-green-600 text-white px-4 py-3 shadow-md
                         flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-wide">💪 My Diet App</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>{user?.display_name ?? user?.username}</span>
          <button
            onClick={handleLogout}
            className="hover:text-green-200 transition-colors"
            aria-label="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Routes>
          <Route path="/"         element={<Dashboard />}    />
          <Route path="/meal"     element={<MealPage />}     />
          <Route path="/walking"  element={<WalkingPage />}  />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/weight"   element={<WeightPage />}   />
          <Route path="/ai"       element={<AiPage />}       />
          <Route path="/profile"  element={<ProfilePage />}  />
          {/* ↑ * より前に全ルートを列挙する */}
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200
                      flex justify-around items-center h-16 shadow-lg z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors
               ${isActive ? 'text-green-600 font-semibold' : 'text-gray-400'}`
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
