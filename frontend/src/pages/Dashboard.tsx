// frontend/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import {
  fetchTodayMeals, fetchGameStatus, fetchWeightHistory,
  fetchWalkingSessions, fetchProfile,
} from '../api'
import type { GameStatus, TodayMealsResponse, UserProfile } from '../api'
import {
  Flame, Footprints, Dumbbell, Scale,
  TrendingDown, TrendingUp, Minus, Trophy, Zap,
} from 'lucide-react'

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
  icon, label, value, unit, color,
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

// PFC バーコンポーネント

function PfcBar({
  protein, fat, carbs, targetProtein, targetFat, targetCarbs,
}: {
  protein: number; fat: number; carbs: number
  targetProtein?: number; targetFat?: number; targetCarbs?: number
}) {
  const total = protein + fat + carbs
  if (total === 0 && !targetProtein) return null

  const pPct = total > 0 ? Math.round((protein / total) * 100) : 0
  const fPct = total > 0 ? Math.round((fat    / total) * 100) : 0
  const cPct = 100 - pPct - fPct

  const remP = targetProtein ? Math.max(0, targetProtein - protein) : null
  const remF = targetFat     ? Math.max(0, targetFat     - fat)     : null
  const remC = targetCarbs   ? Math.max(0, targetCarbs   - carbs)   : null

  return (
    <div>
      {total > 0 && (
        <div className="w-full h-3 rounded-full overflow-hidden flex mb-2">
          <div className="bg-blue-400  transition-all duration-500" style={{ width: `${pPct}%` }} />
          <div className="bg-yellow-400 transition-all duration-500" style={{ width: `${fPct}%` }} />
          <div className="bg-green-400  transition-all duration-500" style={{ width: `${cPct}%` }} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 text-xs">
        {/* タンパク質 */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-400 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            P
          </div>
          <div className="text-gray-700 font-semibold">{protein.toFixed(1)}g</div>
          {remP !== null && (
            <div className={`text-xs ${remP === 0 ? 'text-green-500' : 'text-gray-400'}`}>
              {remP === 0 ? '✓ 達成' : `残 ${remP.toFixed(0)}g`}
            </div>
          )}
        </div>
        {/* 脂質 */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
            F
          </div>
          <div className="text-gray-700 font-semibold">{fat.toFixed(1)}g</div>
          {remF !== null && (
            <div className={`text-xs ${remF === 0 ? 'text-green-500' : 'text-gray-400'}`}>
              {remF === 0 ? '✓ 達成' : `残 ${remF.toFixed(0)}g`}
            </div>
          )}
        </div>
        {/* 炭水化物 */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            C
          </div>
          <div className="text-gray-700 font-semibold">{carbs.toFixed(1)}g</div>
          {remC !== null && (
            <div className={`text-xs ${remC === 0 ? 'text-green-500' : 'text-gray-400'}`}>
              {remC === 0 ? '✓ 達成' : `残 ${remC.toFixed(0)}g`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


export default function Dashboard() {
  const { data: todayData } = useQuery<TodayMealsResponse>({
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

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetchProfile().then(r => r.data),
  })

  const todayCalories  = todayData?.total_calories ?? 0
  const todayProtein   = todayData?.total_protein  ?? 0
  const todayFat       = todayData?.total_fat      ?? 0
  const todayCarbs     = todayData?.total_carbs    ?? 0

  // カロリー目標はプロフィールから取得（未設定なら2000）
  const TARGET_CALORIES = profile?.calorie_goal ?? 2000

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

  const caloriesPct   = Math.min(100, Math.round((todayCalories / TARGET_CALORIES) * 100))
  const caloriesColor = caloriesPct > 90 ? 'text-red-500' : caloriesPct > 70 ? 'text-yellow-500' : 'text-green-600'

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* 今日の日付 */}
      <div className="text-gray-400 text-sm">
        {new Date().toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
        })}
      </div>

      {/* 今日のカロリー進捗 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="text-orange-500" size={20} />
            <span className="font-semibold text-gray-700">今日の摂取カロリー</span>
          </div>
          {profile?.calorie_goal && (
            <span className="text-xs bg-orange-50 text-orange-500 rounded-full px-2 py-0.5 font-medium">
              目標 {TARGET_CALORIES} kcal
            </span>
          )}
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

        {/* PFCバー */}
        {(todayProtein > 0 || todayFat > 0 || todayCarbs > 0 || profile?.recommended_pfc) && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-2 font-medium">今日のPFCバランス</p>
            <PfcBar
              protein={todayProtein}
              fat={todayFat}
              carbs={todayCarbs}
              targetProtein={profile?.recommended_pfc?.protein_g}
              targetFat={profile?.recommended_pfc?.fat_g}
              targetCarbs={profile?.recommended_pfc?.carbs_g}
            />
          </div>
        )}

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
          icon={
            weightDiff === null
              ? <Minus size={14} />
              : weightDiff < 0
                ? <TrendingDown size={14} className="text-green-500" />
                : <TrendingUp size={14} className="text-red-500" />
          }
          label="今月の変化"
          value={
            weightDiff !== null
              ? (weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1))
              : '--'
          }
          unit="kg"
          color={
            weightDiff === null ? 'border-gray-300'
              : weightDiff < 0 ? 'border-green-400' : 'border-red-400'
          }
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
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700
                            text-xs font-bold px-2 py-1 rounded-full">
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
        {(todayData?.meals?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {todayData!.meals.map(meal => (
              <div
                key={meal.id}
                className="flex justify-between items-start py-2
                           border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                      {meal.meal_type === 'breakfast' ? '朝食'
                        : meal.meal_type === 'lunch'  ? '昼食'
                        : meal.meal_type === 'dinner' ? '夕食' : '間食'}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{meal.food_name}</span>
                    <span className="text-xs text-gray-400">({meal.quantity})</span>
                  </div>
                  {/* PFC inline */}
                  {(meal.protein_g || meal.fat_g || meal.carbs_g) && (
                    <div className="flex gap-2 text-xs text-gray-400 mt-0.5 pl-1">
                      <span className="text-blue-400">P {(meal.protein_g ?? 0).toFixed(1)}g</span>
                      <span className="text-yellow-500">F {(meal.fat_g ?? 0).toFixed(1)}g</span>
                      <span className="text-green-500">C {(meal.carbs_g ?? 0).toFixed(1)}g</span>
                    </div>
                  )}
                </div>
                <span className="text-sm font-semibold text-orange-500 ml-2 shrink-0">
                  {Math.round(meal.estimated_calories)} kcal
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">
            まだ食事が記録されていません
          </p>
        )}
      </div>

    </div>
  )
}
