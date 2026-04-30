// frontend/src/pages/MealPage.tsx

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMeals,
  createMealFromText,
  deleteMeal,
  analyzeMealImage,
  createMealWithCalories,
} from '../api'
import type { Meal } from '../api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Loader2, UtensilsCrossed,
  Camera, Type, X, CheckCircle2, RefreshCw
} from 'lucide-react'

// ───── 定数 ─────

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 朝食' },
  { value: 'lunch',     label: '☀️ 昼食' },
  { value: 'dinner',    label: '🌙 夕食' },
  { value: 'snack',     label: '🍪 間食' },
]
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食'
}

// ───── 解析結果の型（ローカル） ─────

interface AnalysisResult {
  description: string
  calories: number
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

// ───── 栄養素バッジ ─────

function NutriBadges({
  protein_g, fat_g, carbs_g
}: {
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}) {
  if (!protein_g && !fat_g && !carbs_g) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {protein_g != null && (
        <span className="text-xs bg-blue-50 text-blue-500 rounded-full px-2 py-0.5">
          P {protein_g}g
        </span>
      )}
      {fat_g != null && (
        <span className="text-xs bg-yellow-50 text-yellow-600 rounded-full px-2 py-0.5">
          F {fat_g}g
        </span>
      )}
      {carbs_g != null && (
        <span className="text-xs bg-orange-50 text-orange-500 rounded-full px-2 py-0.5">
          C {carbs_g}g
        </span>
      )}
    </div>
  )
}

// ───── 画像解析フォーム ─────

function ImageAnalysisForm({ onClose }: { onClose: () => void }) {
  const [mealType, setMealType]       = useState('lunch')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [result, setResult]           = useState<AnalysisResult | null>(null)
  const [edited, setEdited]           = useState<AnalysisResult | null>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 画像解析
  const analyzeMutation = useMutation({
    mutationFn: (file: File) => analyzeMealImage(file),
    onSuccess: (data: AnalysisResult) => {
      setResult(data)
      setEdited(data)
      toast.success('画像を解析しました！')
    },
    onError: () => toast.error('画像の解析に失敗しました'),
  })

  // 確認後保存
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
    setEdited(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleAnalyze = () => {
    if (!selectedFile) { toast.error('画像を選択してください'); return }
    analyzeMutation.mutate(selectedFile)
  }

  const handleSave = () => {
    if (!edited) return
    saveMutation.mutate({
      description: edited.description,
      calories:    edited.calories,
      protein_g:   edited.protein_g,
      fat_g:       edited.fat_g,
      carbs_g:     edited.carbs_g,
      meal_type:   mealType,
    })
  }

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Camera size={18} className="text-orange-500" />
          写真からカロリー推定
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

      {/* 画像選択 */}
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
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
        </div>
      ) : (
        <div className="relative">
          <img src={preview} alt="食事プレビュー"
            className="w-full h-48 object-cover rounded-xl" />
          <button
            onClick={() => { setPreview(null); setSelectedFile(null); setResult(null); setEdited(null) }}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 解析ボタン */}
      {preview && !result && (
        <button
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold
                     hover:bg-orange-600 disabled:opacity-50
                     flex items-center justify-center gap-2"
        >
          {analyzeMutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />Gemmaが解析中...</>
            : <><Camera size={16} />AIで料理を認識する</>}
        </button>
      )}

      {/* 解析結果 */}
      {result && edited && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CheckCircle2 size={16} className="text-green-500" />
            解析結果（編集できます）
          </div>

          {/* 料理名 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">料理名</label>
            <input type="text" className={inputClass}
              value={edited.description}
              onChange={e => setEdited(r => r ? { ...r, description: e.target.value } : r)} />
          </div>

          {/* カロリー */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">推定カロリー (kcal)</label>
            <div className="relative">
              <input type="number" className={inputClass + " pr-16"}
                value={edited.calories}
                onChange={e => setEdited(r => r
                  ? { ...r, calories: parseFloat(e.target.value) || 0 } : r)} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                kcal
              </span>
            </div>
          </div>

          {/* 栄養素（P / F / C） */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              栄養素（g）— AI推定値・修正可
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'protein_g', label: 'タンパク質', color: 'focus:ring-blue-400' },
                { key: 'fat_g',     label: '脂質',       color: 'focus:ring-yellow-400' },
                { key: 'carbs_g',   label: '炭水化物',   color: 'focus:ring-orange-400' },
              ] as const).map(({ key, label, color }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    type="number"
                    className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                                focus:outline-none focus:ring-2 ${color}`}
                    value={edited[key] ?? ''}
                    onChange={e => setEdited(r => r
                      ? { ...r, [key]: parseFloat(e.target.value) || null } : r)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 再解析 */}
          <button
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending}
            className="w-full py-2 border border-orange-200 text-orange-500
                       rounded-xl text-xs hover:bg-orange-50 transition-colors
                       flex items-center justify-center gap-1"
          >
            <RefreshCw size={12} />再解析する
          </button>

          {/* 保存 */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm
                         font-semibold hover:bg-green-700 disabled:opacity-50
                         flex items-center justify-center gap-2"
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

// ───── テキスト入力フォーム ─────

function AddMealForm({ onClose }: { onClose: () => void }) {
  const [mealType, setMealType]       = useState('lunch')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createMealFromText(description, mealType),
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
    if (!description.trim()) { toast.error('食事内容を入力してください'); return }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Type size={18} className="text-green-600" />
          テキストで入力
        </h3>
        <button type="button" onClick={onClose}
          className="text-gray-300 hover:text-gray-500 p-1">
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
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 食事内容 */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">食事内容</label>
        <input
          type="text"
          placeholder="例：ざるそば1人前、おにぎり（鮭）200g"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
        💡 AI（Gemma）が食事内容からカロリー・栄養素を自動推定します
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
          キャンセル
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm
                     font-semibold hover:bg-green-700 disabled:opacity-50
                     flex items-center justify-center gap-2"
        >
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />AI推定中...</>
            : '記録する'}
        </button>
      </div>
    </form>
  )
}

// ───── 日付グループ化 ─────

function groupByDate(meals: Meal[]) {
  return meals.reduce((acc, meal) => {
    const date = new Date(meal.recorded_at).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(meal)
    return acc
  }, {} as Record<string, Meal[]>)
}

// ───── メインページ ─────

export default function MealPage() {
  const [showMode, setShowMode] = useState<'none' | 'text' | 'image'>('none')
  const queryClient = useQueryClient()

  const { data: meals = [], isLoading } = useQuery<Meal[]>({
    queryKey: ['meals'],
    queryFn: () => getMeals(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMeal(id),
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

      {/* フォーム */}
      {showMode === 'image' && <ImageAnalysisForm onClose={() => setShowMode('none')} />}
      {showMode === 'text'  && <AddMealForm       onClose={() => setShowMode('none')} />}

      {/* ローディング */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-green-500" size={28} />
        </div>
      )}

      {/* 食事リスト */}
      {Object.entries(grouped).map(([date, dateMeals]) => {
        const dayTotal = dateMeals.reduce((s, m) => s + (m.calories ?? 0), 0)
        return (
          <div key={date} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 日付ヘッダー */}
            <div className="flex justify-between items-center px-4 py-3
                            bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-600">{date}</span>
              <span className="text-sm font-bold text-orange-500">
                {Math.round(dayTotal)} kcal
              </span>
            </div>

            {/* 食事行 */}
            <div className="divide-y divide-gray-50">
              {dateMeals.map(meal => (
                <div key={meal.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    {/* 食事タイプ + 料理名 */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs bg-green-100 text-green-700
                                       rounded-full px-2 py-0.5 shrink-0">
                        {MEAL_TYPE_LABELS[meal.meal_type ?? ''] ?? '食事'}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {meal.description}
                      </span>
                    </div>

                    {/* カロリー */}
                    <div className="text-xs text-orange-400 font-semibold mt-0.5">
                      {Math.round(meal.calories)} kcal
                    </div>

                    {/* 栄養素バッジ */}
                    <NutriBadges
                      protein_g={meal.protein_g}
                      fat_g={meal.fat_g}
                      carbs_g={meal.carbs_g}
                    />
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => deleteMutation.mutate(meal.id)}
                    className="p-2 text-gray-300 hover:text-red-400
                               transition-colors rounded-lg hover:bg-red-50 shrink-0"
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
