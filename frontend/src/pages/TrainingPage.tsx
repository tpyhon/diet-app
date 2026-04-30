import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPlans, fetchTodaySuggest, fetchGameStatus,
  fetchLogs, createPlan, createLog, deletePlan
} from '../api'
import type { TrainingPlan, Exercise, GameStatus } from '../api'
import toast from 'react-hot-toast'
import {
  Dumbbell, Plus, Trash2, Loader2, Trophy,
  Zap, Flame, ChevronDown, ChevronUp,
  CheckCircle2, Calendar, Star, Sparkles
} from 'lucide-react'
import AiPlanGenerator from '../components/AiPlanGenerator'

// ─── 定数 ────────────────────────────────────────────────
const BODY_PARTS = [
  { value: 'arms',  label: '💪 腕',   color: 'bg-red-100 text-red-600'    },
  { value: 'chest', label: '🫁 胸',   color: 'bg-orange-100 text-orange-600' },
  { value: 'abs',   label: '🔥 腹筋', color: 'bg-yellow-100 text-yellow-600' },
  { value: 'back',  label: '🏔️ 背筋', color: 'bg-green-100 text-green-600'  },
  { value: 'legs',  label: '🦵 脚',   color: 'bg-blue-100 text-blue-600'   },
]

const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日']

const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

function getBodyPartStyle(bp: string) {
  return BODY_PARTS.find(b => b.value === bp)?.color ?? 'bg-gray-100 text-gray-600'
}
function getBodyPartLabel(bp: string) {
  return BODY_PARTS.find(b => b.value === bp)?.label ?? bp
}

// ─── XPバー ─────────────────────────────────────────────
function XpBar({ xp, nextXp, level }: { xp: number; nextXp: number; level: number }) {
  const prevXp = LEVEL_XP[level - 1] ?? 0
  const pct = Math.min(100, Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span className="font-semibold">Lv.{level}</span>
        <span>{xp} / {nextXp} XP</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-400 mt-0.5">次のレベルまで {nextXp - xp} XP</div>
    </div>
  )
}

// ─── プラン作成フォーム ────────────────────────────────────
function CreatePlanForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [bodyPart, setBodyPart] = useState('chest')
  const [dow, setDow] = useState<number | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: '', sets: 3, reps: 10, weight_kg: undefined }
  ])
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['todaySuggest'] })
      toast.success('プランを作成しました！')
      onClose()
    },
    onError: () => toast.error('作成に失敗しました'),
  })

  const addExercise = () =>
    setExercises(ex => [...ex, { name: '', sets: 3, reps: 10, weight_kg: undefined }])

  const removeExercise = (i: number) =>
    setExercises(ex => ex.filter((_, idx) => idx !== i))

  const updateExercise = (i: number, field: keyof Exercise, value: string | number) =>
    setExercises(ex => ex.map((e, idx) =>
      idx === i ? { ...e, [field]: value } : e
    ))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('プラン名を入力してください'); return }
    const valid = exercises.filter(ex => ex.name.trim())
    if (valid.length === 0) { toast.error('種目を1つ以上入力してください'); return }
    mutation.mutate({
      name,
      body_part: bodyPart,
      exercises: valid,
      day_of_week: dow,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <Plus size={18} className="text-purple-500" />
        トレーニングプランを作成
      </h3>

      {/* プラン名 */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">プラン名</label>
        <input
          type="text"
          placeholder="例：胸トレA、脚の日"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* 部位選択 */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">部位</label>
        <div className="grid grid-cols-5 gap-1.5">
          {BODY_PARTS.map(bp => (
            <button
              key={bp.value}
              type="button"
              onClick={() => setBodyPart(bp.value)}
              className={`py-2 rounded-xl text-xs font-medium transition-all
                ${bodyPart === bp.value
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {bp.label}
            </button>
          ))}
        </div>
      </div>

      {/* 曜日設定 */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">実施曜日（任意）</label>
        <div className="flex gap-1.5">
          {DOW_LABELS.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDow(dow === i ? null : i)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                ${dow === i
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 種目リスト */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-gray-500">種目</label>
          <button
            type="button"
            onClick={addExercise}
            className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1"
          >
            <Plus size={12} /> 種目を追加
          </button>
        </div>
        <div className="space-y-2">
          {exercises.map((ex, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="種目名（例：ベンチプレス）"
                  value={ex.name}
                  onChange={e => updateExercise(i, 'name', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs
                             focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(i)}
                    className="text-gray-300 hover:text-red-400 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400">セット</label>
                  <input
                    type="number"
                    min={1} max={20}
                    value={ex.sets}
                    onChange={e => updateExercise(i, 'sets', parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs
                               focus:outline-none focus:ring-1 focus:ring-purple-400 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">回数</label>
                  <input
                    type="number"
                    min={1} max={100}
                    value={ex.reps}
                    onChange={e => updateExercise(i, 'reps', parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs
                               focus:outline-none focus:ring-1 focus:ring-purple-400 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">重量(kg)</label>
                  <input
                    type="number"
                    min={0} step={0.5}
                    placeholder="任意"
                    value={ex.weight_kg ?? ''}
                    onChange={e => updateExercise(i, 'weight_kg',
                      e.target.value ? parseFloat(e.target.value) : 0)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs
                               focus:outline-none focus:ring-1 focus:ring-purple-400 text-center"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
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
          className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold
                     hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />作成中...</>
            : '作成する'
          }
        </button>
      </div>
    </form>
  )
}

// ─── トレーニング実施モーダル ──────────────────────────────
function DoTrainingModal({
  plan,
  onClose
}: {
  plan: TrainingPlan
  onClose: () => void
}) {
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createLog,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] })
      queryClient.invalidateQueries({ queryKey: ['trainingLogs'] })
      const gs = res.data.game_status
      const xp = res.data.log.xp_earned
      toast.success(`+${xp} XP 獲得！🎉`, { duration: 3000 })
      if (gs.streak_days >= 3) {
        setTimeout(() => toast(`🔥 ${gs.streak_days}日連続！ストリークボーナス！`, { duration: 3000 }), 1000)
      }
      onClose()
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const handleDone = () => {
    mutation.mutate({
      plan_id: plan.id,
      body_part: plan.body_part,
      exercises: plan.exercises,
      duration_minutes: duration,
      notes: notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{plan.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${getBodyPartStyle(plan.body_part)}`}>
            {getBodyPartLabel(plan.body_part)}
          </span>
        </div>

        {/* 種目一覧 */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {plan.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-gray-700">{ex.name}</span>
              <span className="text-xs text-gray-500">
                {ex.sets}セット × {ex.reps}回
                {ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ''}
              </span>
            </div>
          ))}
        </div>

        {/* 所要時間 */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">
            実施時間：<span className="font-bold text-purple-600">{duration}分</span>
          </label>
          <input
            type="range"
            min={5} max={120} step={5}
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-300 mt-1">
            <span>5分</span><span>60分</span><span>120分</span>
          </div>
        </div>

        {/* メモ */}
        <input
          type="text"
          placeholder="メモ（任意）例：調子良かった"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        {/* XP予告 */}
        <div className="bg-yellow-50 rounded-xl px-4 py-3 flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="text-sm text-yellow-700 font-semibold">完了で +50 XP 獲得！</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleDone}
            disabled={mutation.isPending}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700
                       text-white text-sm font-bold hover:opacity-90
                       disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending
              ? <><Loader2 size={16} className="animate-spin" />記録中...</>
              : <><CheckCircle2 size={16} />トレーニング完了！</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── プランカード ────────────────────────────────────────
function PlanCard({
  plan,
  onStart,
  onDelete,
}: {
  plan: TrainingPlan
  onStart: (plan: TrainingPlan) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{plan.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getBodyPartStyle(plan.body_part)}`}>
              {getBodyPartLabel(plan.body_part)}
            </span>
            {plan.day_of_week != null && (
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                毎週{DOW_LABELS[plan.day_of_week]}曜
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{plan.exercises.length}種目</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(v => !v)}
            className="p-2 text-gray-300 hover:text-gray-500 rounded-lg"
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(plan.id)}
            className="p-2 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => onStart(plan)}
            className="ml-1 bg-purple-600 text-white text-xs font-bold
                       px-3 py-2 rounded-xl hover:bg-purple-700 transition-colors"
          >
            開始
          </button>
        </div>
      </div>

      {/* 展開：種目詳細 */}
      {open && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-1.5">
          {plan.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
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

// ─── メインページ ────────────────────────────────────────
export default function TrainingPage() {
  const [showForm, setShowForm] = useState(false)
  const [showAiGenerator, setShowAiGenerator] = useState(false)
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null)
  const [tab, setTab] = useState<'today' | 'all' | 'log'>('today')
  const queryClient = useQueryClient()

  const { data: plans = [] } = useQuery<TrainingPlan[]>({
    queryKey: ['plans'],
    queryFn: () => fetchPlans().then(r => r.data),
  })

  const { data: todaySuggest } = useQuery({
    queryKey: ['todaySuggest'],
    queryFn: () => fetchTodaySuggest().then(r => r.data),
  })

  const { data: gameStatus } = useQuery<GameStatus>({
    queryKey: ['gameStatus'],
    queryFn: () => fetchGameStatus().then(r => r.data),
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['trainingLogs'],
    queryFn: () => fetchLogs().then(r => r.data),
    enabled: tab === 'log',
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['todaySuggest'] })
      toast.success('プランを削除しました')
    },
  })

  const todayPlans: TrainingPlan[] = todaySuggest?.suggested_plans ?? []
  const todayDow: number = todaySuggest?.day_of_week ?? new Date().getDay()

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* トレーニングモーダル */}
      {activePlan && (
        <DoTrainingModal
          plan={activePlan}
          onClose={() => setActivePlan(null)}
        />
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Dumbbell className="text-purple-500" size={22} />
          筋トレ
        </h2>
        <div className="flex gap-2">
          {/* AI生成ボタン */}
          <button
            onClick={() => { setShowAiGenerator(v => !v); setShowForm(false) }}
            className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-purple-700
                      text-white px-3 py-2 rounded-xl text-sm font-semibold
                      hover:opacity-90 transition-all shadow-sm"
          >
            <Sparkles size={15} />
            AI生成
          </button>
          {/* 手動追加ボタン */}
          <button
            onClick={() => { setShowForm(v => !v); setShowAiGenerator(false) }}
            className="flex items-center gap-1 bg-purple-600 text-white px-3 py-2
                      rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            <Plus size={15} />
            手動追加
          </button>
        </div>
      </div>

      {/* プラン作成フォーム */}
      {showForm && <CreatePlanForm onClose={() => setShowForm(false)} />}
      
      {/* AI生成フォーム */}
      {showAiGenerator && (
        <AiPlanGenerator onClose={() => setShowAiGenerator(false)} />
      )}


      {/* ゲームステータス */}
      {gameStatus && (
        <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-2xl p-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-yellow-300" />
              <span className="font-bold">トレーニングステータス</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
              <Zap size={12} className="text-yellow-300" />
              Lv.{gameStatus.level}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-1 mb-3">
            <div className="flex justify-between text-xs mb-1 px-1">
              <span>Lv.{gameStatus.level}</span>
              <span>{gameStatus.total_xp} / {gameStatus.next_level_xp} XP</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-yellow-300 to-orange-400 h-2.5 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.round(
                    ((gameStatus.total_xp - (LEVEL_XP[gameStatus.level - 1] ?? 0)) /
                    (gameStatus.next_level_xp - (LEVEL_XP[gameStatus.level - 1] ?? 0))) * 100
                  ))}%`
                }}
              />
            </div>
          </div>
          <div className="flex gap-3 text-center">
            <div className="flex-1 bg-white/10 rounded-xl py-2">
              <p className="text-xl font-bold">{gameStatus.streak_days}</p>
              <p className="text-xs text-white/70">日連続</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl py-2">
              <p className="text-xl font-bold">{gameStatus.total_xp}</p>
              <p className="text-xs text-white/70">総XP</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl py-2">
              <p className="text-xl font-bold">{plans.length}</p>
              <p className="text-xs text-white/70">プラン数</p>
            </div>
          </div>
          {gameStatus.streak_days >= 3 && (
            <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 text-xs text-yellow-200 text-center">
              🔥 {gameStatus.streak_days}日連続中！この調子で続けよう！
            </div>
          )}
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {([
          { key: 'today', label: '📅 今日', icon: Calendar },
          { key: 'all',   label: '📋 全プラン', icon: Dumbbell },
          { key: 'log',   label: '📜 履歴', icon: Star },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${tab === t.key
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 今日タブ ── */}
      {tab === 'today' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={16} />
            <span>
              今日（{DOW_LABELS[todayDow]}曜日）のプラン
              {todayPlans.length === 0 && ' — 設定なし'}
            </span>
          </div>
          {todayPlans.length > 0 ? (
            todayPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onStart={setActivePlan}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 shadow-sm">
              <Dumbbell size={40} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">今日の曜日に設定されたプランがありません</p>
              <p className="text-xs mt-1">「全プラン」タブから手動で開始できます</p>
            </div>
          )}
          {/* 他のプランも実施できる */}
          {plans.filter(p => p.day_of_week !== todayDow).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 px-1">他のプランも実施できます</p>
              {plans
                .filter(p => p.day_of_week !== todayDow)
                .map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onStart={setActivePlan}
                    onDelete={id => deleteMutation.mutate(id)}
                  />
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── 全プランタブ ── */}
      {tab === 'all' && (
        <div className="space-y-3">
          {plans.length > 0 ? (
            plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onStart={setActivePlan}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 shadow-sm">
              <Dumbbell size={40} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">プランがありません</p>
              <p className="text-xs mt-1">「プラン追加」から作成しましょう</p>
            </div>
          )}
        </div>
      )}

      {/* ── 履歴タブ ── */}
      {tab === 'log' && (
        <div className="space-y-3">
          {logs.length > 0 ? (
            logs.map((log: {
              id: number
              date: string
              body_part: string
              duration_minutes: number
              xp_earned: number
              notes?: string
              exercises_json: string
            }) => (
              <div key={log.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getBodyPartStyle(log.body_part)}`}>
                      {getBodyPartLabel(log.body_part)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {log.duration_minutes}分
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full font-bold">
                    <Zap size={11} />
                    +{log.xp_earned} XP
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(log.date).toLocaleDateString('ja-JP', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                {log.notes && (
                  <p className="text-xs text-gray-500 mt-1">📝 {log.notes}</p>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 shadow-sm">
              <Flame size={40} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">トレーニング履歴がありません</p>
              <p className="text-xs mt-1">プランを開始してトレーニングを記録しましょう</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
