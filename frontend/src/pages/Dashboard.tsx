import { useQuery } from '@tanstack/react-query'
import { fetchTodayMeals, fetchGameStatus, fetchWeightHistory, fetchWalkingSessions } from '../api'
import type { GameStatus } from '../api'   // ← 型は type インポート
import { Flame, Footprints, Dumbbell, Scale, TrendingDown, TrendingUp, Minus, Trophy, Zap } from 'lucide-react'


// XPバーコンポーネント
function XpBar({ xp, nextXp, level }: { xp: number; nextXp: number; level: number }) {
  const prevXp = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000][level - 1] ?? 0
  const pct = Math.min(100, Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Lv.{level}</span>
        <span>{xp} / {nextXp} XP</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// サマリーカードコンポーネント
function SummaryCard({
  icon, label, value, unit, color
}: {
  icon: React.ReactNode; label: string; value: string | number; unit: string; color: string
}) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${color}`}>
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        <span className="text-sm text-gray-400 mb-0.5">{unit}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: todayData } = useQuery({
    queryKey: ['todayMeals'],
    queryFn: () => fetchTodayMeals().then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: gameData } = useQuery<GameStatus>({
    queryKey: ['gameStatus'],
    queryFn: () => fetchGameStatus().then(r => r.data),
  })


  const { data: weightData } = useQuery({
    queryKey: ['weightHistory', '1month'],
    queryFn: () => fetchWeightHistory('1month').then(r => r.data),
  })

  const { data: walkData } = useQuery({
    queryKey: ['walkingSessions'],
    queryFn: () => fetchWalkingSessions().then(r => r.data),
  })

  const todayCalories = todayData?.total_calories ?? 0
  const TARGET_CALORIES = 2000

  const latestWeight = weightData?.length > 0 ? weightData[weightData.length - 1].weight_kg : null
  const firstWeight  = weightData?.length > 1 ? weightData[0].weight_kg : null
  const weightDiff   = latestWeight && firstWeight ? (latestWeight - firstWeight) : null

  const weekWalkKm = walkData
    ?.filter((w: { start_time: string }) => {
      const d = new Date(w.start_time)
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      return d >= weekAgo
    })
    .reduce((sum: number, w: { distance_km: number }) => sum + (w.distance_km ?? 0), 0) ?? 0

  const caloriesPct = Math.min(100, Math.round((todayCalories / TARGET_CALORIES) * 100))
  const caloriesColor = caloriesPct > 90 ? 'text-red-500' : caloriesPct > 70 ? 'text-yellow-500' : 'text-green-600'

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* 今日の日付 */}
      <div className="text-gray-400 text-sm">
        {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </div>

      {/* 今日のカロリー進捗 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="text-orange-500" size={20} />
          <span className="font-semibold text-gray-700">今日の摂取カロリー</span>
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className={`text-4xl font-bold ${caloriesColor}`}>
            {Math.round(todayCalories)}
          </span>
          <span className="text-gray-400 text-sm mb-1">/ {TARGET_CALORIES} kcal</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${
              caloriesPct > 90 ? 'bg-red-400' : caloriesPct > 70 ? 'bg-yellow-400' : 'bg-green-500'
            }`}
            style={{ width: `${caloriesPct}%` }}
          />
        </div>
        <div className="text-right text-xs text-gray-400 mt-1">{caloriesPct}%</div>
      </div>

      {/* サマリーグリッド */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<Scale size={14} />}
          label="現在の体重"
          value={latestWeight ?? '--'}
          unit="kg"
          color="border-blue-400"
        />
        <SummaryCard
          icon={weightDiff === null ? <Minus size={14} /> : weightDiff < 0 ? <TrendingDown size={14} className="text-green-500" /> : <TrendingUp size={14} className="text-red-500" />}
          label="今月の変化"
          value={weightDiff !== null ? (weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1)) : '--'}
          unit="kg"
          color={weightDiff === null ? 'border-gray-300' : weightDiff < 0 ? 'border-green-400' : 'border-red-400'}
        />
        <SummaryCard
          icon={<Footprints size={14} />}
          label="今週のウォーク"
          value={weekWalkKm.toFixed(1)}
          unit="km"
          color="border-cyan-400"
        />
        <SummaryCard
          icon={<Dumbbell size={14} />}
          label="ストリーク"
          value={gameData?.streak_days ?? 0}
          unit="日連続"
          color="border-purple-400"
        />
      </div>

      {/* ゲームステータス */}
      {gameData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="text-yellow-500" size={20} />
              <span className="font-semibold text-gray-700">トレーニングレベル</span>
            </div>
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">
              <Zap size={12} />
              Lv.{gameData.level}
            </div>
          </div>
          <XpBar xp={gameData.total_xp} nextXp={gameData.next_level_xp} level={gameData.level} />
          {gameData.streak_days >= 3 && (
            <div className="mt-3 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
              🔥 {gameData.streak_days}日連続トレーニング中！この調子で続けよう！
            </div>
          )}
        </div>
      )}

      {/* 今日の食事リスト */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="text-green-500" size={20} />
          <span className="font-semibold text-gray-700">今日の食事</span>
        </div>
        {todayData?.meals?.length > 0 ? (
          <div className="space-y-2">
            {todayData.meals.map((meal: { id: number; meal_type: string; food_name: string; quantity: string; estimated_calories: number }) => (
              <div key={meal.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 mr-2">
                    {meal.meal_type === 'breakfast' ? '朝食' :
                     meal.meal_type === 'lunch' ? '昼食' :
                     meal.meal_type === 'dinner' ? '夕食' : '間食'}
                  </span>
                  <span className="text-sm text-gray-700">{meal.food_name}</span>
                  <span className="text-xs text-gray-400 ml-1">({meal.quantity})</span>
                </div>
                <span className="text-sm font-semibold text-orange-500">
                  {Math.round(meal.estimated_calories)} kcal
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">まだ食事が記録されていません</p>
        )}
      </div>

    </div>
  )
}
