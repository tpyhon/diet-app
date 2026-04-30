import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateAiPlan } from '../api'
import type { AiPlanRequest } from '../api'
import toast from 'react-hot-toast'
import { Bot, Loader2, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

// ── 選択肢定義 ───────────────────────────────────────────
const FITNESS_LEVELS = [
  { value: 'beginner',     label: '🌱 初心者',  desc: '運動習慣がほぼない' },
  { value: 'intermediate', label: '💪 中級者',  desc: '週1〜2回の運動習慣あり' },
  { value: 'advanced',     label: '🔥 上級者',  desc: '週3回以上のトレーニング経験あり' },
]

const GOALS = [
  { value: 'diet',   label: '🔥 ダイエット', desc: '脂肪燃焼・体重減少' },
  { value: 'muscle', label: '💪 筋肥大',     desc: '筋肉量増加・筋力向上' },
  { value: 'health', label: '🌿 健康維持',   desc: '体力向上・健康増進' },
]

const BODY_PARTS = [
  { value: 'arms',  label: '💪 腕'   },
  { value: 'chest', label: '🫁 胸'   },
  { value: 'abs',   label: '🔥 腹筋' },
  { value: 'back',  label: '🏔️ 背筋' },
  { value: 'legs',  label: '🦵 脚'   },
]

const EQUIPMENT = [
  { value: 'none',     label: '🤸 自重のみ',    desc: '器具なし・自宅OK' },
  { value: 'dumbbell', label: '🏋️ ダンベルあり', desc: 'ダンベル・簡単な器具' },
  { value: 'gym',      label: '🏟️ ジム',         desc: '全器具使用可' },
]

// ── 生成結果表示 ─────────────────────────────────────────
function GeneratedPlanResult({
  result,
  onClose,
}: {
  result: { saved_count: number; plans: unknown[]; comment: string }
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      {/* 成功バナー */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-green-700">
            {result.saved_count}件のプランを生成・保存しました！
          </p>
          <p className="text-sm text-green-600 mt-1">{result.comment}</p>
        </div>
      </div>

      {/* 生成されたプラン一覧 */}
      <div className="space-y-2">
        {(result.plans as {
          name: string
          body_part: string
          day_of_week: number
          exercises: { name: string; sets: number; reps: number; weight_kg?: number }[]
        }[]).map((plan, i) => (
          <PlanPreviewCard key={i} plan={plan} />
        ))}
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold
                   hover:bg-purple-700 transition-colors"
      >
        筋トレページで確認する
      </button>
    </div>
  )
}

function PlanPreviewCard({ plan }: {
  plan: {
    name: string
    body_part: string
    day_of_week: number
    exercises: { name: string; sets: number; reps: number; weight_kg?: number }[]
  }
}) {
  const [open, setOpen] = useState(false)
  const DOW = ['月', '火', '水', '木', '金', '土', '日']

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 text-left">
          <span className="font-semibold text-gray-800 text-sm">{plan.name}</span>
          {plan.day_of_week != null && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
              {DOW[plan.day_of_week]}曜
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs">{plan.exercises.length}種目</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-1.5">
          {plan.exercises.map((ex, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-600">{ex.name}</span>
              <span className="text-gray-400">
                {ex.sets}×{ex.reps}
                {ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────
export default function AiPlanGenerator({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<AiPlanRequest>({
    fitness_level: 'beginner',
    goal: 'diet',
    available_days: 3,
    target_parts: ['chest', 'abs', 'legs'],
    equipment: 'none',
    minutes_per_session: 30,
    notes: '',
  })
  const [result, setResult] = useState<{
    saved_count: number; plans: unknown[]; comment: string
  } | null>(null)

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: generateAiPlan,
    onSuccess: (res) => {
      setResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['todaySuggest'] })
    },
    onError: () => toast.error('プランの生成に失敗しました'),
  })

  const togglePart = (part: string) => {
    setForm(f => ({
      ...f,
      target_parts: f.target_parts.includes(part)
        ? f.target_parts.filter(p => p !== part)
        : [...f.target_parts, part],
    }))
  }

  const handleGenerate = () => {
    if (form.target_parts.length === 0) {
      toast.error('部位を1つ以上選択してください')
      return
    }
    mutation.mutate(form)
  }

  // 生成結果表示
  if (result) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="text-purple-500" size={20} />
          <h3 className="font-bold text-gray-800">AIプラン生成完了！</h3>
        </div>
        <GeneratedPlanResult result={result} onClose={onClose} />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">

      {/* ヘッダー */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
          <Bot size={18} className="text-purple-500" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">AIトレーニングプラン生成</h3>
          <p className="text-xs text-gray-400">Gemma 4があなた専用のプランを作成します</p>
        </div>
      </div>

      {/* フィットネスレベル */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          現在のフィットネスレベル
        </label>
        <div className="space-y-2">
          {FITNESS_LEVELS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, fitness_level: value as AiPlanRequest['fitness_level'] }))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                ${form.fitness_level === value
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex-1">
                <p className={`text-sm font-semibold ${form.fitness_level === value ? 'text-purple-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              {form.fitness_level === value && (
                <CheckCircle2 size={18} className="text-purple-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 目標 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">目標</label>
        <div className="space-y-2">
          {GOALS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, goal: value as AiPlanRequest['goal'] }))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                ${form.goal === value
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex-1">
                <p className={`text-sm font-semibold ${form.goal === value ? 'text-purple-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              {form.goal === value && (
                <CheckCircle2 size={18} className="text-purple-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 鍛えたい部位 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          鍛えたい部位（複数選択可）
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {BODY_PARTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => togglePart(value)}
              className={`py-2.5 rounded-xl text-xs font-medium transition-all
                ${form.target_parts.includes(value)
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 器具 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">使用可能な器具</label>
        <div className="space-y-2">
          {EQUIPMENT.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, equipment: value as AiPlanRequest['equipment'] }))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                ${form.equipment === value
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex-1">
                <p className={`text-sm font-semibold ${form.equipment === value ? 'text-purple-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              {form.equipment === value && (
                <CheckCircle2 size={18} className="text-purple-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 週のトレーニング日数 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          週のトレーニング日数：
          <span className="text-purple-600 font-bold ml-1">{form.available_days}日</span>
        </label>
        <input
          type="range"
          min={1} max={6} step={1}
          value={form.available_days}
          onChange={e => setForm(f => ({ ...f, available_days: parseInt(e.target.value) }))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-300 mt-1">
          {[1,2,3,4,5,6].map(d => <span key={d}>{d}日</span>)}
        </div>
      </div>

      {/* 1回あたりの時間 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          1回あたりの時間：
          <span className="text-purple-600 font-bold ml-1">{form.minutes_per_session}分</span>
        </label>
        <input
          type="range"
          min={15} max={90} step={5}
          value={form.minutes_per_session}
          onChange={e => setForm(f => ({ ...f, minutes_per_session: parseInt(e.target.value) }))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-300 mt-1">
          <span>15分</span><span>45分</span><span>90分</span>
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">
          備考・制約 <span className="text-gray-300 font-normal">任意</span>
        </label>
        <input
          type="text"
          placeholder="例：腰が弱い、膝に不安あり、腹筋を重点的に"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* ボタン */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm"
        >
          キャンセル
        </button>
        <button
          onClick={handleGenerate}
          disabled={mutation.isPending}
          className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700
                     text-white font-bold hover:opacity-90 disabled:opacity-50
                     flex items-center justify-center gap-2 shadow-md transition-all"
        >
          {mutation.isPending ? (
            <><Loader2 size={18} className="animate-spin" />Gemmaが考え中...</>
          ) : (
            <><Sparkles size={18} />AIでプランを生成</>
          )}
        </button>
      </div>

      {mutation.isPending && (
        <p className="text-center text-xs text-gray-400 animate-pulse">
          🤖 Gemma 4 があなたに最適なプランを設計しています...
        </p>
      )}

    </div>
  )
}
