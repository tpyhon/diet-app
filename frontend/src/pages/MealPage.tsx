// frontend/src/pages/MealPage.tsx
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMeals, createMeal, deleteMeal, analyzeFoodImage, createMealWithCalories } from '../api'
import type { Meal, ImageAnalysisResult } from '../api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Loader2, UtensilsCrossed,
  Camera, Type, CheckCircle2, RefreshCw, X,
} from 'lucide-react'

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 朝食' },
  { value: 'lunch',     label: '☀️ 昼食' },
  { value: 'dinner',    label: '🌙 夕食' },
  { value: 'snack',     label: '🍪 間食' },
]
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食',
}

// ── PFCバッジコンポーネント ──────────────────────────────────
function PfcBadges({
  protein, fat, carbs,
}: {
  protein?: number; fat?: number; carbs?: number
}) {
  if (!protein && !fat && !carbs) return null
  return (
    <div className="flex gap-1.5 mt-1">
      <span className="text-xs bg-blue-50 text-blue-500 rounded px-1.5 py-0.5 font-medium">
        P {(protein ?? 0).toFixed(1)}g
      </span>
      <span className="text-xs bg-yellow-50 text-yellow-600 rounded px-1.5 py-0.5 font-medium">
        F {(fat ?? 0).toFixed(1)}g
      </span>
      <span className="text-xs bg-green-50 text-green-600 rounded px-1.5 py-0.5 font-medium">
        C {(carbs ?? 0).toFixed(1)}g
      </span>
    </div>
  )
}

// ── 栄養素入力フィールド（解析結果編集用） ────────────────────
function NutritionFields({
  value,
  onChange,
}: {
  value: ImageAnalysisResult
  onChange: (v: ImageAnalysisResult) => void
}) {
  const numField = (
    label: string,
    key: keyof Pick<ImageAnalysisResult, 'estimated_calories' | 'protein_g' | 'fat_g' | 'carbs_g'>,
    unit: string,
    color: string,
  ) => (
    <div>
      <label className={`text-xs mb-1 block ${color}`}>{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value[key]}
          onChange={e =>
            onChange({ ...value, [key]: parseFloat(e.target.value) || 0 })
          }
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-400 pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
          {unit}
        </span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-3">
      {numField('カロリー', 'estimated_calories', 'kcal', 'text-orange-500')}
      {numField('タンパク質', 'protein_g', 'g', 'text-blue-500')}
      {numField('脂質', 'fat_g', 'g', 'text-yellow-600')}
      {numField('炭水化物', 'carbs_g', 'g', 'text-green-600')}
    </div>
  )
}

// ── 画像解析フォーム ─────────────────────────────────────────
function ImageAnalysisForm({ onClose }: { onClose: () => void }) {
  const [mealType, setMealType]         = useState('lunch')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview]           = useState<string | null>(null)
  const [result, setResult]             = useState<ImageAnalysisResult | null>(null)
  const [editedResult, setEditedResult] = useState<ImageAnalysisResult | null>(null)
  const fileInputRef                    = useRef<HTMLInputElement>(null)
  const cameraInputRef                  = useRef<HTMLInputElement>(null)
  const queryClient                     = useQueryClient()

  const analyzeMutation = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) =>
      analyzeFoodImage(file, type).then(r => r.data),
    onSuccess: (data: ImageAnalysisResult) => {
      setResult(data)
      setEditedResult(data)
      toast.success('画像を解析しました！')
    },
    onError: () => toast.error('画像の解析に失敗しました'),
  })

  const saveMutation = useMutation({
    mutationFn: createMealWithCalories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeals'] })
      toast.success('食事を記録しました！')
      onClose()
    },
    onError: () => toast.error('保存に失敗しました'),
  })

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setResult(null)
    setEditedResult(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleAnalyze = () => {
    if (!selectedFile) { toast.error('画像を選択してください'); return }
    analyzeMutation.mutate({ file: selectedFile, type: mealType })
  }

  const handleSave = () => {
    if (!editedResult) return
    saveMutation.mutate({
      meal_type:          mealType,
      food_name:          editedResult.food_name,
      quantity:           editedResult.quantity,
      estimated_calories: editedResult.estimated_calories,
      protein_g:          editedResult.protein_g,
      fat_g:              editedResult.fat_g,
      carbs_g:            editedResult.carbs_g,
      notes:              editedResult.description || undefined,
    })
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Camera size={18} className="text-orange-500" />
          写真からAI推定
        </h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1">
          <X size={18} />
        </button>
      </div>

      {/* 食事タイプ */}
      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMealType(value)}
            className={`py-2 rounded-xl text-xs font-medium transition-all
              ${mealType === value
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 画像選択エリア */}
      {!preview ? (
        <div className="space-y-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full py-4 border-2 border-dashed border-orange-200
                       rounded-2xl text-orange-400 hover:border-orange-300
                       hover:bg-orange-50 transition-all flex items-center
                       justify-center gap-2 text-sm font-medium"
          >
            <Camera size={20} />カメラで撮影
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 border-2 border-dashed border-gray-200
                       rounded-2xl text-gray-400 hover:border-gray-300
                       hover:bg-gray-50 transition-all flex items-center
                       justify-center gap-2 text-sm"
          >
            <Plus size={16} />ライブラリから選択
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*"
            capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="relative">
          <img src={preview} alt="食事プレビュー"
            className="w-full h-48 object-cover rounded-xl" />
          <button
            onClick={() => { setPreview(null); setSelectedFile(null); setResult(null); setEditedResult(null) }}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 解析ボタン */}
      {preview && !result && (
        <button onClick={handleAnalyze} disabled={analyzeMutation.isPending}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold
                     hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {analyzeMutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />Gemmaが解析中...</>
            : <><Camera size={16} />AIで料理を認識する</>}
        </button>
      )}

      {/* 解析結果 */}
      {result && editedResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CheckCircle2 size={16} className="text-green-500" />
            解析結果（編集できます）
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">料理名</label>
            <input type="text" value={editedResult.food_name}
              onChange={e => setEditedResult(r => r ? { ...r, food_name: e.target.value } : r)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">量</label>
            <input type="text" value={editedResult.quantity}
              onChange={e => setEditedResult(r => r ? { ...r, quantity: e.target.value } : r)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* カロリー＋PFC 編集 */}
          <NutritionFields value={editedResult} onChange={setEditedResult} />

          {editedResult.description && (
            <div className="bg-orange-50 rounded-xl px-4 py-3 text-xs text-orange-700">
              💡 {editedResult.description}
            </div>
          )}

          <button onClick={handleAnalyze} disabled={analyzeMutation.isPending}
            className="w-full py-2 border border-orange-200 text-orange-500 rounded-xl
                       text-xs hover:bg-orange-50 flex items-center justify-center gap-1"
          >
            <RefreshCw size={12} />再解析する
          </button>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm">
              キャンセル
            </button>
            <button onClick={handleSave} disabled={saveMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                         hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saveMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" />保存中...</>
                : <><CheckCircle2 size={16} />この内容で記録する</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── テキスト入力フォーム ──────────────────────────────────────
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
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Type size={18} className="text-green-600" />テキストで入力
        </h3>
        <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map(({ value, label }) => (
          <button key={value} type="button"
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

      <div>
        <label className="text-xs text-gray-500 mb-1 block">食品名・メニュー名</label>
        <input type="text" placeholder="例：ざるそば、おにぎり（鮭）"
          value={form.food_name}
          onChange={e => setForm(f => ({ ...f, food_name: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">量・サイズ</label>
        <input type="text" placeholder="例：1人前、200g、普通盛り"
          value={form.quantity}
          onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
        💡 AI（Gemma）が食品名・量からカロリーとPFC（タンパク質・脂質・炭水化物）を自動推定します
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
          キャンセル
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                     hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />AI推定中...</>
            : '記録する'}
        </button>
      </div>
    </form>
  )
}

// ── 日付グループ化 ────────────────────────────────────────────
function groupByDate(meals: Meal[]) {
  return meals.reduce((acc, meal) => {
    const date = new Date(meal.date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(meal)
    return acc
  }, {} as Record<string, Meal[]>)
}

// ── メインページ ──────────────────────────────────────────────
export default function MealPage() {
  const [showMode, setShowMode] = useState<'none' | 'text' | 'image'>('none')
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowMode(m => m === 'image' ? 'none' : 'image')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-colors
              ${showMode === 'image'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
          >
            <Camera size={15} />写真
          </button>
          <button
            onClick={() => setShowMode(m => m === 'text' ? 'none' : 'text')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-colors
              ${showMode === 'text'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
          >
            <Type size={15} />テキスト
          </button>
        </div>
      </div>

      {showMode === 'image' && <ImageAnalysisForm onClose={() => setShowMode('none')} />}
      {showMode === 'text'  && <AddMealForm       onClose={() => setShowMode('none')} />}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-green-500" size={28} />
        </div>
      )}

      {/* 食事リスト */}
      {Object.entries(grouped).map(([date, dateMeals]) => {
        const dayTotal   = dateMeals.reduce((s, m) => s + (m.estimated_calories ?? 0), 0)
        const dayProtein = dateMeals.reduce((s, m) => s + (m.protein_g ?? 0), 0)
        const dayFat     = dateMeals.reduce((s, m) => s + (m.fat_g ?? 0), 0)
        const dayCarbs   = dateMeals.reduce((s, m) => s + (m.carbs_g ?? 0), 0)
        return (
          <div key={date} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 日付ヘッダー */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">{date}</span>
                <span className="text-sm font-bold text-orange-500">
                  {Math.round(dayTotal)} kcal
                </span>
              </div>
              {/* 日合計PFC */}
              {(dayProtein > 0 || dayFat > 0 || dayCarbs > 0) && (
                <div className="flex gap-3 mt-1.5 text-xs">
                  <span className="text-blue-400 font-medium">P {dayProtein.toFixed(1)}g</span>
                  <span className="text-yellow-500 font-medium">F {dayFat.toFixed(1)}g</span>
                  <span className="text-green-500 font-medium">C {dayCarbs.toFixed(1)}g</span>
                </div>
              )}
            </div>

            {/* 食事アイテム */}
            <div className="divide-y divide-gray-50">
              {dateMeals.map(meal => (
                <div key={meal.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs bg-green-100 text-green-700
                                       rounded-full px-2 py-0.5 shrink-0">
                        {MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {meal.food_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{meal.quantity}</span>
                      <span>·</span>
                      <span className="text-orange-400 font-semibold">
                        {Math.round(meal.estimated_calories)} kcal
                      </span>
                    </div>
                    <PfcBadges
                      protein={meal.protein_g}
                      fat={meal.fat_g}
                      carbs={meal.carbs_g}
                    />
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(meal.id)}
                    className="p-2 text-gray-300 hover:text-red-400
                               transition-colors rounded-lg hover:bg-red-50 mt-0.5"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!isLoading && meals.length === 0 && showMode === 'none' && (
        <div className="text-center py-16 text-gray-400">
          <UtensilsCrossed size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">食事の記録がありません</p>
          <p className="text-xs mt-1">📸 写真 または ✏️ テキストから記録しましょう</p>
        </div>
      )}

    </div>
  )
}
