import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchWeightHistory, createWeight, deleteWeight,
  fetchWeightGoal, setWeightGoal, fetchPredictionData
} from '../api'
import type { WeightRecord, WeightGoalCreate } from '../api'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import {
  Scale, Plus, Trash2, Loader2,
  TrendingDown, TrendingUp, Minus,
  Target, Trophy, CalendarCheck, X
} from 'lucide-react'

const PERIODS = [
  { value: '1week',   label: '1週間' },
  { value: '1month',  label: '1ヶ月' },
  { value: '6months', label: '6ヶ月' },
  { value: '1year',   label: '1年'   },
]

// カスタムツールチップ
function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: {value: number; name: string; color: string}[]; label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
        <p className="text-gray-400">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-bold">
            {p.name}: {p.value?.toFixed(1)} kg
          </p>
        ))}
      </div>
    )
  }
  return null
}

// 目標設定フォーム
function GoalForm({ onClose, currentWeight }: {
  onClose: () => void; currentWeight?: number
}) {
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: setWeightGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightGoal'] })
      queryClient.invalidateQueries({ queryKey: ['predictionData'] })
      toast.success('目標を設定しました！')
      onClose()
    },
    onError: () => toast.error('設定に失敗しました'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = parseFloat(target)
    if (isNaN(t) || t < 20 || t > 300) {
      toast.error('正しい目標体重を入力してください')
      return
    }
    const data: WeightGoalCreate = { target_weight_kg: t }
    if (targetDate) data.target_date = new Date(targetDate).toISOString()
    mutation.mutate(data)
  }

  const diff = currentWeight && target
    ? (currentWeight - parseFloat(target)).toFixed(1)
    : null

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Target size={18} className="text-purple-500" />
          目標体重を設定
        </h3>
        <button type="button" onClick={onClose}
          className="text-gray-300 hover:text-gray-500">
          <X size={18} />
        </button>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">目標体重 (kg)</label>
        <div className="relative">
          <input
            type="number" step="0.1" placeholder="例：65.0"
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-400 pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
        </div>
        {diff && parseFloat(diff) > 0 && (
          <p className="text-xs text-purple-500 mt-1 ml-1">
            現在から {diff} kg 減量が目標です
          </p>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          目標期日 <span className="text-gray-300">任意</span>
        </label>
        <input
          type="date"
          value={targetDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => setTargetDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm">
          キャンセル
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-purple-500 text-white text-sm
                     font-semibold hover:bg-purple-600 disabled:opacity-50
                     flex items-center justify-center gap-2">
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />設定中...</>
            : '目標を設定する'
          }
        </button>
      </div>
    </form>
  )
}

// 体重入力フォーム
function AddWeightForm({ onClose }: { onClose: () => void }) {
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightHistory'] })
      queryClient.invalidateQueries({ queryKey: ['predictionData'] })
      queryClient.invalidateQueries({ queryKey: ['weightGoal'] })
      toast.success('体重を記録しました！')
      onClose()
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseFloat(weight)
    if (isNaN(w) || w < 20 || w > 300) {
      toast.error('正しい体重を入力してください')
      return
    }
    mutation.mutate({
      weight_kg: w,
      body_fat_pct: bodyFat ? parseFloat(bodyFat) : undefined,
      notes: notes || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Plus size={18} className="text-blue-500" />
          体重を記録
        </h3>
        <button type="button" onClick={onClose}
          className="text-gray-300 hover:text-gray-500">
          <X size={18} />
        </button>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">体重 (kg) *</label>
        <div className="relative">
          <input
            type="number" step="0.1" placeholder="例：68.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          体脂肪率 (%) <span className="text-gray-300">任意</span>
        </label>
        <div className="relative">
          <input
            type="number" step="0.1" placeholder="例：22.5"
            value={bodyFat}
            onChange={e => setBodyFat(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          メモ <span className="text-gray-300">任意</span>
        </label>
        <input
          type="text" placeholder="例：朝食前、運動後"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm">
          キャンセル
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm
                     font-semibold hover:bg-blue-600 disabled:opacity-50
                     flex items-center justify-center gap-2">
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />記録中...</>
            : '記録する'
          }
        </button>
      </div>
    </form>
  )
}

export default function WeightPage() {
  const [period, setPeriod] = useState('1month')
  const [showForm, setShowForm] = useState<'none' | 'weight' | 'goal'>('none')
  const queryClient = useQueryClient()

  const { data: records = [], isLoading } = useQuery<WeightRecord[]>({
    queryKey: ['weightHistory', period],
    queryFn: () => fetchWeightHistory(period).then(r => r.data),
  })

  const { data: goalData } = useQuery({
    queryKey: ['weightGoal'],
    queryFn: () => fetchWeightGoal().then(r => r.data),
  })

  const { data: predData } = useQuery({
    queryKey: ['predictionData'],
    queryFn: () => fetchPredictionData().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightHistory'] })
      queryClient.invalidateQueries({ queryKey: ['predictionData'] })
      toast.success('削除しました')
    },
  })

  // 統計
  const weights   = records.map(r => r.weight_kg)
  const latest    = weights.at(-1)
  const first     = weights.at(0)
  const minW      = weights.length ? Math.min(...weights) : null
  const maxW      = weights.length ? Math.max(...weights) : null
  const diff      = latest != null && first != null && records.length > 1
    ? parseFloat((latest - first).toFixed(1)) : null
  const avgW      = weights.length
    ? parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)) : null

  // グラフデータ（実績 + 予測を合成）
  const chartData = (() => {
    const actualMap: Record<string, { actual?: number; target?: number; predicted?: number }> = {}
    for (const r of records) {
      const key = new Date(r.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
      actualMap[key] = {
        actual: r.weight_kg,
        target: goalData?.goal?.target_weight_kg,
      }
    }
    const result = Object.entries(actualMap).map(([date, v]) => ({ date, ...v }))

    // 予測ライン（最大10点まで）
    if (predData?.prediction?.length > 0) {
      const predSlice = predData.prediction.slice(0, 10)
      for (const p of predSlice) {
        result.push({
          date: p.date,
          target: goalData?.goal?.target_weight_kg,
          predicted: p.predicted,
        })
      }
    }
    return result
  })()

  const yMin = minW ? parseFloat((minW - 3).toFixed(0)) : 0
  const yMax = maxW ? parseFloat((maxW + 3).toFixed(0)) : 100

  // 目標達成状況
  const prediction = goalData?.prediction
  const goal       = goalData?.goal

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Scale className="text-blue-500" size={22} />
          体重記録
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(f => f === 'goal' ? 'none' : 'goal')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm
                        font-semibold transition-colors
                        ${showForm === 'goal'
                          ? 'bg-purple-500 text-white'
                          : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
          >
            <Target size={14} />
            目標
          </button>
          <button
            onClick={() => setShowForm(f => f === 'weight' ? 'none' : 'weight')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm
                        font-semibold transition-colors
                        ${showForm === 'weight'
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
          >
            <Plus size={14} />
            記録
          </button>
        </div>
      </div>

      {/* フォーム */}
      {showForm === 'goal' && (
        <GoalForm
          onClose={() => setShowForm('none')}
          currentWeight={latest}
        />
      )}
      {showForm === 'weight' && (
        <AddWeightForm onClose={() => setShowForm('none')} />
      )}

      {/* 目標達成バナー */}
      {prediction?.achieved && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400
                        rounded-2xl p-4 text-white text-center shadow-md">
          <Trophy size={32} className="mx-auto mb-2" />
          <p className="font-bold text-lg">目標達成おめでとう！🎉</p>
          <p className="text-sm opacity-90">目標体重 {goal?.target_weight_kg} kg を達成しました！</p>
        </div>
      )}

      {/* 目標カード */}
      {goal && !prediction?.achieved && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="text-purple-500" size={18} />
              <span className="font-semibold text-gray-700 text-sm">目標</span>
            </div>
            <span className="text-lg font-bold text-purple-600">
              {goal.target_weight_kg} kg
            </span>
          </div>

          {prediction?.days_remaining != null && (
            <div className="space-y-2">
              {/* 進捗バー */}
              {latest && first && (
                (() => {
                  const total   = Math.abs((first ?? latest) - goal.target_weight_kg)
                  const done    = Math.abs(latest - (first ?? latest))
                  const pct     = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
                  return (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>進捗 {pct}%</span>
                        <span>残り {prediction.remaining_kg} kg</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-purple-400 to-purple-600
                                     h-2.5 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })()
              )}

              {/* 予測日 */}
              <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
                <CalendarCheck size={16} className="text-purple-500 shrink-0" />
                <div className="text-xs">
                  <span className="text-gray-500">このペースで続けると </span>
                  <span className="font-bold text-purple-600">
                    {new Date(prediction.predicted_date).toLocaleDateString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                  <span className="text-gray-500"> 頃に達成予定</span>
                  <span className="text-purple-500 font-semibold ml-1">
                    （あと {prediction.days_remaining} 日）
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">
                ペース：{Math.abs(prediction.daily_change_kg * 7).toFixed(2)} kg / 週
              </p>
            </div>
          )}

          {prediction?.on_track === false && (
            <div className="bg-red-50 rounded-xl px-3 py-2 text-xs text-red-500">
              ⚠️ {prediction.message}
            </div>
          )}
        </div>
      )}

      {/* 期間タブ */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${period === p.value
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-blue-400" size={28} />
        </div>
      )}

      {!isLoading && records.length > 0 && (
        <>
          {/* 最新体重カード */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">現在の体重</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-800">
                    {latest?.toFixed(1)}
                  </span>
                  <span className="text-gray-400 mb-1">kg</span>
                </div>
              </div>
              {diff !== null && (
                <div className={`flex items-center gap-1 px-3 py-2 rounded-xl
                                 text-sm font-bold
                  ${diff < 0 ? 'bg-green-50 text-green-600' :
                    diff > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}
                >
                  {diff < 0 ? <TrendingDown size={16} /> :
                   diff > 0 ? <TrendingUp size={16} /> : <Minus size={16} />}
                  {diff > 0 ? '+' : ''}{diff} kg
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
              <div className="text-center">
                <p className="text-xs text-gray-400">最小</p>
                <p className="text-sm font-bold text-blue-500">{minW?.toFixed(1)} kg</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">平均</p>
                <p className="text-sm font-bold text-gray-700">{avgW?.toFixed(1)} kg</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">最大</p>
                <p className="text-sm font-bold text-red-400">{maxW?.toFixed(1)} kg</p>
              </div>
            </div>
          </div>

          {/* グラフ（実績 + 予測ライン + 目標ライン） */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-1">体重推移・予測</p>
            {goal && (
              <p className="text-xs text-gray-400 mb-3">
                破線：予測ライン　点線：目標 {goal.target_weight_kg} kg
              </p>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[yMin, yMax] as [number, number]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* 目標ライン */}
                {goal && (
                  <ReferenceLine
                    y={goal.target_weight_kg}
                    stroke="#a855f7"
                    strokeDasharray="6 3"
                    label={{ value: `目標 ${goal.target_weight_kg}kg`, fontSize: 9, fill: '#a855f7' }}
                  />
                )}
                {/* 実績ライン */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="実績"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                {/* 予測ライン */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="予測"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 記録リスト */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-600">記録一覧</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {[...records].reverse().map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-gray-800">
                        {r.weight_kg.toFixed(1)} kg
                      </span>
                      {r.body_fat_pct && (
                        <span className="text-xs text-gray-400">
                          体脂肪 {r.body_fat_pct.toFixed(1)}%
                        </span>
                      )}
                      {goal && (
                        <span className={`text-xs font-semibold
                          ${r.weight_kg <= goal.target_weight_kg
                            ? 'text-green-500' : 'text-gray-300'}`}
                        >
                          {r.weight_kg <= goal.target_weight_kg ? '✓ 目標達成' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>
                        {new Date(r.date).toLocaleDateString('ja-JP', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                      {r.notes && <><span>·</span><span>{r.notes}</span></>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    className="p-2 text-gray-300 hover:text-red-400
                               transition-colors rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!isLoading && records.length === 0 && showForm === 'none' && (
        <div className="text-center py-16 text-gray-400">
          <Scale size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">体重の記録がありません</p>
          <p className="text-xs mt-1">「記録」ボタンから追加しましょう</p>
        </div>
      )}

    </div>
  )
}
