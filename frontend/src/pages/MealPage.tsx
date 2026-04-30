import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMeals, createMeal, deleteMeal } from '../api'
import type { Meal } from '../api'   // ← type インポートに変更
import toast from 'react-hot-toast'
import { Plus, Trash2, Loader2, UtensilsCrossed } from 'lucide-react'


const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 朝食' },
  { value: 'lunch',     label: '☀️ 昼食' },
  { value: 'dinner',    label: '🌙 夕食' },
  { value: 'snack',     label: '🍪 間食' },
]

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食'
}

// 食事追加フォーム
function AddMealForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ meal_type: 'lunch', food_name: '', quantity: '' })
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeals'] })
      toast.success('食事を記録しました！')
      onClose()
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.food_name.trim() || !form.quantity.trim()) {
      toast.error('食品名と量を入力してください')
      return
    }
    mutation.mutate(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <Plus size={18} className="text-green-600" />
        食事を追加
      </h3>

      {/* 食事タイプ選択 */}
      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setForm(f => ({ ...f, meal_type: value }))}
            className={`py-2 rounded-xl text-xs font-medium transition-all
              ${form.meal_type === value
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 食品名 */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">食品名・メニュー名</label>
        <input
          type="text"
          placeholder="例：ざるそば、おにぎり（鮭）、チキン定食"
          value={form.food_name}
          onChange={e => setForm(f => ({ ...f, food_name: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* 量 */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">量・サイズ</label>
        <input
          type="text"
          placeholder="例：1人前、200g、普通盛り、Mサイズ"
          value={form.quantity}
          onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
        💡 AI（Gemma）が食品名と量からカロリーを自動推定します
      </div>

      {/* ボタン */}
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
          className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                     hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              AI推定中...
            </>
          ) : '記録する'}
        </button>
      </div>
    </form>
  )
}

// 日付グループ化ヘルパー
function groupByDate(meals: Meal[]) {
  return meals.reduce((acc, meal) => {
    const date = new Date(meal.date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(meal)
    return acc
  }, {} as Record<string, Meal[]>)
}

export default function MealPage() {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['meals'],
    queryFn: () => fetchMeals().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeals'] })
      toast.success('削除しました')
    },
  })

  const grouped = groupByDate(meals)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <UtensilsCrossed className="text-green-600" size={22} />
          食事記録
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && <AddMealForm onClose={() => setShowForm(false)} />}

      {/* ローディング */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-green-500" size={28} />
        </div>
      )}

      {/* 食事リスト（日付グループ） */}
      {Object.entries(grouped).map(([date, dateMeals]) => {
        const dayTotal = dateMeals.reduce((s, m) => s + (m.estimated_calories ?? 0), 0)
        return (
          <div key={date} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 日付ヘッダー */}
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-600">{date}</span>
              <span className="text-sm font-bold text-orange-500">{Math.round(dayTotal)} kcal</span>
            </div>
            {/* 食事アイテム */}
            <div className="divide-y divide-gray-50">
              {dateMeals.map(meal => (
                <div key={meal.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 shrink-0">
                        {MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">{meal.food_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{meal.quantity}</span>
                      <span>·</span>
                      <span className="text-orange-400 font-semibold">{Math.round(meal.estimated_calories)} kcal</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(meal.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* 空状態 */}
      {!isLoading && meals.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400">
          <UtensilsCrossed size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">食事の記録がありません</p>
          <p className="text-xs mt-1">「追加」ボタンから記録しましょう</p>
        </div>
      )}

    </div>
  )
}
