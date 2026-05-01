// frontend/src/App.tsx
import { useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Home, UtensilsCrossed, Footprints, Dumbbell, Scale, Bot, LogOut, User } from 'lucide-react'
import Dashboard    from './pages/Dashboard'
import MealPage     from './pages/MealPage'
import WeightPage   from './pages/WeightPage'
import AiPage       from './pages/AiPage'
import TrainingPage from './pages/TrainingPage'
import WalkingPage  from './pages/WalkingPage'
import LoginPage    from './pages/LoginPage'
import ProfilePage  from './pages/ProfilePage'

const navItems = [
  { to: '/',         icon: Home,            label: 'ホーム'   },
  { to: '/meal',     icon: UtensilsCrossed, label: '食事'     },
  { to: '/walking',  icon: Footprints,      label: 'ウォーク' },
  { to: '/training', icon: Dumbbell,        label: '筋トレ'   },
  { to: '/weight',   icon: Scale,           label: '体重'     },
  { to: '/ai',       icon: Bot,             label: 'AI'       },
]

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('access_token')
  )
  const [user, setUser] = useState<{ username: string; display_name: string } | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  )
  const [showProfile, setShowProfile] = useState(false)

  const handleLogin = (newToken: string, newUser: { username: string; display_name: string }) => {
    setToken(newToken)
    setUser(newUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
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
      <header className="bg-green-600 text-white px-4 py-3 shadow-md flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-wide">💪 My Diet App</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{user?.display_name || user?.username}</span>
          {/* プロフィールボタン */}
          <button
            onClick={() => setShowProfile(v => !v)}
            className={`hover:text-green-200 transition-colors ${showProfile ? 'text-green-200' : ''}`}
            title="プロフィール設定"
          >
            <User size={18} />
          </button>
          <button onClick={handleLogout} className="hover:text-green-200 transition-colors" title="ログアウト">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-20 overflow-y-auto">
        {/* プロフィールパネル（オーバーレイ） */}
        {showProfile && (
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowProfile(false)}>
            <div
              className="absolute top-0 right-0 h-full w-full max-w-md bg-gray-50
                         overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-4 py-3 bg-green-600 text-white">
                <span className="font-semibold flex items-center gap-2">
                  <User size={18} />プロフィール設定
                </span>
                <button onClick={() => setShowProfile(false)}
                  className="hover:text-green-200 transition-colors text-xl font-bold">
                  ×
                </button>
              </div>
              <ProfilePage />
            </div>
          </div>
        )}

        <Routes>
          <Route path="/"         element={<Dashboard />}    />
          <Route path="/meal"     element={<MealPage />}     />
          <Route path="/walking"  element={<WalkingPage />}  />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/weight"   element={<WeightPage />}   />
          <Route path="/ai"       element={<AiPage />}       />
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
