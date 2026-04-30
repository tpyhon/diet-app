import { Routes, Route, NavLink } from 'react-router-dom'
import { Home, UtensilsCrossed, Footprints, Dumbbell, Scale, Bot } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import MealPage  from './pages/MealPage'

// 未実装ページは仮表示
const WalkingPage  = () => <div className="p-4"><h1 className="text-2xl font-bold text-green-600">🚶 ウォーキング（実装予定）</h1></div>
const TrainingPage = () => <div className="p-4"><h1 className="text-2xl font-bold text-green-600">💪 筋トレ（実装予定）</h1></div>
const WeightPage   = () => <div className="p-4"><h1 className="text-2xl font-bold text-green-600">⚖️ 体重記録（実装予定）</h1></div>
const AiPage       = () => <div className="p-4"><h1 className="text-2xl font-bold text-green-600">🤖 AIアドバイス（実装予定）</h1></div>

const navItems = [
  { to: '/',         icon: Home,            label: 'ホーム'   },
  { to: '/meal',     icon: UtensilsCrossed, label: '食事'     },
  { to: '/walking',  icon: Footprints,      label: 'ウォーク' },
  { to: '/training', icon: Dumbbell,        label: '筋トレ'   },
  { to: '/weight',   icon: Scale,           label: '体重'     },
  { to: '/ai',       icon: Bot,             label: 'AI'       },
]

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      <header className="bg-green-600 text-white px-4 py-3 shadow-md">
        <h1 className="text-lg font-bold tracking-wide">💪 My Diet App</h1>
      </header>

      <main className="flex-1 pb-20 overflow-y-auto">
        <Routes>
          <Route path="/"         element={<Dashboard />}    />
          <Route path="/meal"     element={<MealPage />}     />
          <Route path="/walking"  element={<WalkingPage />}  />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/weight"   element={<WeightPage />}   />
          <Route path="/ai"       element={<AiPage />}       />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 shadow-lg z-50">
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
