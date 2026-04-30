import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWeightHistory, createWeight, deleteWeight } from '../api'
import type { WeightRecord } from '../api'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Scale, Plus, Trash2, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'

// 期間タブ
const PERIODS = [
  { value: '1week',   label: '1週間' },
  { value: '1month',  label: '1ヶ月' },
  { value: '6months', label: '6ヶ月' },
  { value: '1year',   label: '1年'   },
]

// カスタムツールチップ
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-sm">
        <p className="text-gray-500 text-xs">{label}</p>
        <p className="font-bold text-blue-600">{payload[0].value.toFixed(1)} kg</p>
      </div>
    )
  }
  return null
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
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <Plus size={18} className="text-blue-500" />
        体重を記録
      </h3>

      {/* 体重 */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">体重 (kg) *</label>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            placeholder="例：68.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
        </div>
      </div>

      {/* 体脂肪率（任意） */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">体脂肪率 (%) <span className="text-gray-300">任意</span></label>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            placeholder="例：22.5"
            value={bodyFat}
            onChange={e => setBodyFat(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
      </div>

      {/* メモ（任意） */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">メモ <span className="text-gray-300">任意</span></label>
        <input
          type="text"
          placeholder="例：朝食前、運動後"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold
                     hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
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
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: records = [], isLoading } = useQuery<WeightRecord[]>({
    queryKey: ['weightHistory', period],
    queryFn: () => fetchWeightHistory(period).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightHistory'] })
      toast.success('削除しました')
    },
  })

  // グラフ用データ整形
  const chartData = records.map(r => ({
    date: new Date(r.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
    weight: r.weight_kg,
    bodyFat: r.body_fat_pct,
  }))

  // 統計計算
  const weights = records.map(r => r.weight_kg)
  const latest  = weights.at(-1)
  const first   = weights.at(0)
  const minW    = weights.length ? Math.min(...weights) : null
  const maxW    = weights.length ? Math.max(...weights) : null
  const diff    = latest != null && first != null && records.length > 1
    ? parseFloat((latest - first).toFixed(1))
    : null
  const avgW    = weights.length
    ? parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1))
    : null

  // グラフのY軸範囲（見やすく±2kg）
  const yMin: number = minW != null ? parseFloat((minW - 2).toFixed(0)) : 0
  const yMax: number = maxW != null ? parseFloat((maxW + 2).toFixed(0)) : 100


  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Scale className="text-blue-500" size={22} />
          体重記録
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2
                     rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          記録
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && <AddWeightForm onClose={() => setShowForm(false)} />}

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

      {/* ローディング */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-blue-400" size={28} />
        </div>
      )}

      {/* 統計カード */}
      {!isLoading && records.length > 0 && (
        <>
          {/* 最新体重 + 変化 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">現在の体重</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-800">{latest?.toFixed(1)}</span>
                  <span className="text-gray-400 mb-1">kg</span>
                </div>
              </div>
              {diff !== null && (
                <div className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold
                  ${diff < 0 ? 'bg-green-50 text-green-600' :
                    diff > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}
                >
                  {diff < 0 ? <TrendingDown size={16} /> :
                   diff > 0 ? <TrendingUp size={16} /> :
                   <Minus size={16} />}
                  {diff > 0 ? '+' : ''}{diff} kg
                </div>
              )}
            </div>

            {/* サブ統計 */}
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

          {/* グラフ */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">体重推移</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
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
                {avgW != null && (
                   <ReferenceLine
                    y={avgW as number}
                    stroke="#93c5fd"
                    strokeDasharray="4 4"
                    label={{ value: '平均', fontSize: 10, fill: '#93c5fd' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5 }}
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
                      <span className="text-base font-bold text-gray-800">{r.weight_kg.toFixed(1)} kg</span>
                      {r.body_fat_pct && (
                        <span className="text-xs text-gray-400">体脂肪 {r.body_fat_pct.toFixed(1)}%</span>
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
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 空状態 */}
      {!isLoading && records.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400">
          <Scale size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">体重の記録がありません</p>
          <p className="text-xs mt-1">「記録」ボタンから追加しましょう</p>
        </div>
      )}

    </div>
  )
}
