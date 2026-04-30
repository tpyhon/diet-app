// frontend/src/pages/Dashboard.tsx

import { useQuery } from '@tanstack/react-query'
import { getTodayMeals, getGameStatus, getWeightHistory, getWalkingSessions } from '../api'
import type { GameStatus, TodayMeals, WeightRecord, WalkingSession } from '../api'
import {
  Flame, Footprints, Dumbbell, Scale,
  TrendingDown, TrendingUp, Minus, Trophy, Zap
} from 'lucide-react'

// ───── XPバー ─────

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

// ───── サマリーカード ─────

function SummaryCard({
  icon, label, value, unit, color
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  unit: string
  color: string
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

// ───── 栄養素バー ─────

function NutrientBar({
  label, value, color
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`bg-gray-50 rounded-xl py-3 px-2 text-center`}>
      <p className={`font-bold text-lg ${color}`}>{value.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">g</span></p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

// ───── Dashboard ─────

export default function Dashboard() {

  const { data: todayData } = useQuery<TodayMeals>({
    queryKey: ['todayMeals'],
    queryFn: () => getTodayMeals(),
    refetchInterval: 30000,
  })

  const { data: gameData } = useQuery<GameStatus>({
    queryKey: ['gameStatus'],
    queryFn: () => getGameStatus(),
  })

  const { data: weightData } = useQuery<WeightRecord[]>({
    queryKey: ['weightHistory', '1month'],
    queryFn: () => getWeightHistory('1month'),
  })

  const { data: walkData } = useQuery<WalkingSession[]>({
    queryKey: ['walkingSessions'],
    queryFn: () => getWalkingSessions(),
  })

  // ── カロリー ──
  const todayCalories = todayData?.total_calories ?? 0
  const calorieGoal   = todayData?.calorie_goal ?? 2000   // ← 個人設定を使用
  const caloriesPct   = Math.min(100, Math.round((todayCalories / calorieGoal) * 100))
  const caloriesColor =
    caloriesPct > 90 ? 'text-red-500' :
    caloriesPct > 70 ? 'text-yellow-500' : 'text-green-600'

  // ── 栄養素 ──
  const totalProtein = todayData?.total_protein_g ?? 0
  const totalFat     = todayData?.total_fat_g ?? 0
  const totalCarbs   = todayData?.total_carbs_g ?? 0

  // ── 体重 ──
  const latestWeight = (weightData?.length ?? 0) > 0
    ? weightData![weightData!.length - 1].weight_kg : null
  const firstWeight  = (weightData?.length ?? 0) > 1
    ? weightData![0].weight_kg : null
  const weightDiff   = latestWeight && firstWeight
    ? (latestWeight - firstWeight) : null

  // ── 今週のウォーク ──
  const weekWalkKm = walkData
    ?.filter((w: WalkingSession) => {
      const d = new Date(w.start_time)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return d >= weekAgo
    })
    .reduce((sum: number, w: WalkingSession) => sum + (w.distance_km ?? 0), 0) ?? 0

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* 今日の日付 */}
      <div className="text-gray-400 text-sm">
        {new Date().toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
        })}
      </div>

      {/* ── 今日のカロリー進捗 ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="text-orange-500" size={20} />
          <span className="font-semibold text-gray-700">今日の摂取カロリー</span>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <span className={`text-4xl font-bold ${caloriesColor}`}>
            {Math.round(todayCalories)}
          </span>
          <span className="text-gray-400 text-sm mb-1">/ {calorieGoal} kcal</span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${
              caloriesPct > 90 ? 'bg-red-400' :
              caloriesPct > 70 ? 'bg-yellow-400' : 'bg-green-500'
            }`}
            style={{ width: `${caloriesPct}%` }}
          />
        </div>
        <div className="text-right text-xs text-gray-400 mt-1">{caloriesPct}%</div>

        {/* 栄養素サマリー */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <NutrientBar label="タンパク質" value={totalProtein} color="text-blue-500" />
          <NutrientBar label="脂質"       value={totalFat}     color="text-yellow-500" />
          <NutrientBar label="炭水化物"   value={totalCarbs}   color="text-orange-500" />
        </div>
      </div>

      {/* ── サマリーグリッド ── */}
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
            weightDiff === null ? <Minus size={14} /> :
            weightDiff < 0
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
            weightDiff === null ? 'border-gray-300' :
            weightDiff < 0 ? 'border-green-400' : 'border-red-400'
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

      {/* ── ゲームステータス ── */}
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

      {/* ── 今日の食事リスト ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="text-green-500" size={20} />
          <span className="font-semibold text-gray-700">今日の食事</span>
        </div>

        {(todayData?.meals?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {todayData!.meals.map((meal) => (
              <div
                key={meal.id}
                className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  {/* 食事タイプバッジ */}
                  <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 mr-2">
                    {meal.meal_type === 'breakfast' ? '朝食' :
                     meal.meal_type === 'lunch'     ? '昼食' :
                     meal.meal_type === 'dinner'    ? '夕食' : '間食'}
                  </span>
                  {/* 料理名 */}
                  <span className="text-sm text-gray-700">{meal.description}</span>

                  {/* 栄養素バッジ */}
                  {(meal.protein_g || meal.fat_g || meal.carbs_g) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {meal.protein_g != null && (
                        <span className="text-xs bg-blue-50 text-blue-500 rounded-full px-2 py-0.5">
                          P {meal.protein_g}g
                        </span>
                      )}
                      {meal.fat_g != null && (
                        <span className="text-xs bg-yellow-50 text-yellow-600 rounded-full px-2 py-0.5">
                          F {meal.fat_g}g
                        </span>
                      )}
                      {meal.carbs_g != null && (
                        <span className="text-xs bg-orange-50 text-orange-500 rounded-full px-2 py-0.5">
                          C {meal.carbs_g}g
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* カロリー */}
                <span className="text-sm font-semibold text-orange-500 ml-2 shrink-0">
                  {Math.round(meal.calories)} kcal
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
