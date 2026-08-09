// frontend/src/pages/ProfilePage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProfile, updateProfile, suggestCalorieGoal, fetchDynamicTdee } from '../api'
import type { UserProfile, ProfileUpdate, RecommendedPfc, DynamicTdeeResult } from '../api'
import toast from 'react-hot-toast'
import { User, Sparkles, Loader2, Save, Bot, Target, Gauge, ShieldAlert } from 'lucide-react'

const PACE_OPTIONS = [
  { value: '0.25', label: '0.25%（ゆっくり）' },
  { value: '0.5',  label: '0.5%（標準）' },
  { value: '0.75', label: '0.75%（やや積極的）' },
  { value: '1.0',  label: '1.0%（積極的）' },
]

// ── セレクトフィールドコンポーネント ─────────────────────────
function SelectField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
      >
        <option value="">未設定</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── 数値入力コンポーネント ────────────────────────────────────
function NumberField({
  label, value, onChange, unit, placeholder, min, max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit?: string
  placeholder?: string
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-400 pr-12"
        />
        {unit && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 推奨PFCカードコンポーネント ──────────────────────────────
function RecommendedPfcCard({ pfc }: { pfc: RecommendedPfc }) {
  const total = pfc.ratio.protein_pct + pfc.ratio.fat_pct + pfc.ratio.carbs_pct

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-purple-500" />
        <span className="font-semibold text-gray-700 text-sm">推奨PFCバランス</span>
        <span className="text-xs text-gray-400 ml-auto">1日の目標量</span>
      </div>

      {/* PFCバー */}
      <div className="w-full h-4 rounded-full overflow-hidden flex">
        <div
          className="bg-blue-400 transition-all duration-700 flex items-center justify-center"
          style={{ width: `${pfc.ratio.protein_pct / total * 100}%` }}
        />
        <div
          className="bg-yellow-400 transition-all duration-700"
          style={{ width: `${pfc.ratio.fat_pct / total * 100}%` }}
        />
        <div
          className="bg-green-400 transition-all duration-700"
          style={{ width: `${pfc.ratio.carbs_pct / total * 100}%` }}
        />
      </div>

      {/* PFC数値 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xs text-blue-400 font-medium mb-1">
            タンパク質 {pfc.ratio.protein_pct}%
          </div>
          <div className="text-xl font-bold text-blue-500">{pfc.protein_g}</div>
          <div className="text-xs text-blue-300">g / 日</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <div className="text-xs text-yellow-600 font-medium mb-1">
            脂質 {pfc.ratio.fat_pct}%
          </div>
          <div className="text-xl font-bold text-yellow-500">{pfc.fat_g}</div>
          <div className="text-xs text-yellow-400">g / 日</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xs text-green-600 font-medium mb-1">
            炭水化物 {pfc.ratio.carbs_pct}%
          </div>
          <div className="text-xl font-bold text-green-500">{pfc.carbs_g}</div>
          <div className="text-xs text-green-400">g / 日</div>
        </div>
      </div>
    </div>
  )
}

// ── カロリー目標カードコンポーネント ─────────────────────────
function CalorieGoalCard({
  calorieGoal,
  onSuggest,
  isSuggesting,
}: {
  calorieGoal: number
  onSuggest: () => void
  isSuggesting: boolean
}) {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 shadow-sm border border-orange-200">
      <div className="flex items-center gap-2 mb-3">
        <Target className="text-orange-500" size={20} />
        <span className="font-semibold text-gray-700">1日カロリー目標</span>
      </div>
      <div className="flex items-end gap-2 mb-4">
        <span className="text-4xl font-bold text-orange-500">{calorieGoal}</span>
        <span className="text-gray-400 text-sm mb-1">kcal / 日</span>
      </div>
      <button
        onClick={onSuggest}
        disabled={isSuggesting}
        className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold
                   hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2
                   transition-colors"
      >
        {isSuggesting
          ? <><Loader2 size={15} className="animate-spin" />AI分析中...</>
          : <><Bot size={15} />AIに最適なカロリー目標＆PFCを提案させる</>
        }
      </button>
      <p className="text-xs text-orange-400 mt-2 text-center">
        ※ 下のプロフィールを保存後に押してください
      </p>
    </div>
  )
}

// ── 動的TDEEカードコンポーネント ─────────────────────────────
function DynamicTdeeCard({ tdee }: { tdee: DynamicTdeeResult }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-cyan-100">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-cyan-500" />
        <span className="font-semibold text-gray-700 text-sm">今日の動的カロリー目標</span>
        {tdee.needs_recalibration ? (
          <span className="ml-auto text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">
            要再調整
          </span>
        ) : tdee.is_estimated_mode ? (
          <span className="ml-auto text-xs bg-amber-100 text-amber-600 rounded-full px-2 py-0.5">
            推定モード
          </span>
        ) : tdee.adaptive_tdee_active && (
          <span className="ml-auto text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">
            アダプティブ補正中
          </span>
        )}
      </div>

      {tdee.needs_recalibration && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <ShieldAlert size={16} className="text-red-500 mt-0.5 shrink-0" />
          <span className="text-xs text-red-600">
            体重・食事の記録が14日以上途絶えています。デフォルトTDEE（{tdee.tdee}kcal）にリセットしました。
            記録を再開すると自動で再調整されます。
          </span>
        </div>
      )}
      {!tdee.needs_recalibration && tdee.is_estimated_mode && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <span className="text-xs text-amber-600">
            体重・食事の記録が{tdee.consecutive_missing_days}日間途絶えているため、
            アダプティブ補正を一時停止し静的TDEEを使用しています。
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">BMR</div>
          <div className="text-lg font-bold text-gray-700">{tdee.bmr}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">運動消費（本日）</div>
          <div className="text-lg font-bold text-gray-700">{tdee.exercise_calories_today}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">静的TDEE（BMR×PAL＋運動）</div>
          <div className="text-lg font-bold text-gray-700">{tdee.static_tdee}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">目標赤字（ペース{tdee.pace_pct}%）</div>
          <div className="text-lg font-bold text-gray-700">-{tdee.target_deficit}</div>
        </div>
      </div>

      {tdee.adaptive_tdee_active ? (
        <div className="bg-purple-50 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-500">過去14日 平均摂取カロリー</span>
            <span className="font-semibold text-purple-700">{tdee.avg_cal_in_14d} kcal</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-500">体重変化（14日間）</span>
            <span className="font-semibold text-purple-700">{tdee.delta_weight_kg_14d! > 0 ? '+' : ''}{tdee.delta_weight_kg_14d} kg</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-500">実測修正TDEE</span>
            <span className="font-semibold text-purple-700">{tdee.calculated_tdee} kcal</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-100">
            <span className="text-purple-600">採用TDEE（実測70%＋静的30%）</span>
            <span className="font-bold text-purple-700">{tdee.tdee} kcal</span>
          </div>
        </div>
      ) : !tdee.is_estimated_mode && !tdee.needs_recalibration ? (
        <p className="text-xs text-gray-400">
          ※ 食事記録が過去14日間で{tdee.valid_days_count_14d}/10日（体重記録も2件以上必要）のため、
          静的TDEEをそのまま使用しています。記録を続けるとアダプティブ補正が有効になります。
        </p>
      ) : null}

      <div className="bg-cyan-50 rounded-xl p-4 text-center">
        <div className="text-xs text-cyan-500 mb-1">最終目標カロリー / 日</div>
        <div className="text-3xl font-bold text-cyan-600">{tdee.target_calories}<span className="text-sm ml-1">kcal</span></div>
        {tdee.target_calories !== tdee.base_target_calories && (
          <div className="text-xs text-cyan-400 mt-1">（赤字ベース計算値: {tdee.base_target_calories} kcal）</div>
        )}
      </div>

      {tdee.ea_guard_active && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <ShieldAlert size={16} className="text-red-500 mt-0.5 shrink-0" />
          <span className="text-xs text-red-600">
            健康上の安全のため最小カロリーに制限中です（EA: {tdee.ea_value} kcal/kgLBM）
          </span>
        </div>
      )}

      {tdee.recommended_pfc ? (
        <RecommendedPfcCard pfc={tdee.recommended_pfc} />
      ) : (
        <p className="text-xs text-gray-400">
          ※ 体脂肪率を入力するとLBMベースのPFC配分が表示されます
        </p>
      )}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────────
export default function ProfilePage() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetchProfile().then(r => r.data),
  })

  // フォームステート
  const [displayName, setDisplayName]     = useState('')
  const [age, setAge]                     = useState('')
  const [gender, setGender]               = useState('')
  const [heightCm, setHeightCm]           = useState('')
  const [weightKg, setWeightKg]           = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [dietGoal, setDietGoal]           = useState('')
  const [calorieGoal, setCalorieGoal]     = useState('')
  const [bodyFatPct, setBodyFatPct]       = useState('')
  const [pacePct, setPacePct]             = useState('0.5')
  const [initialized, setInitialized]     = useState(false)

  // 動的TDEE（年齢・性別・身長・体重が揃っていれば取得）
  const tdeeReady = !!(profile?.age && profile?.gender && profile?.height_cm && profile?.weight_kg)
  const { data: dynamicTdee } = useQuery<DynamicTdeeResult>({
    queryKey: ['dynamic-tdee'],
    queryFn: () => fetchDynamicTdee().then(r => r.data),
    enabled: tdeeReady,
  })

  // AI提案結果のPFCを一時保持（保存前の表示用）
  const [suggestedPfc, setSuggestedPfc] = useState<RecommendedPfc | null>(null)

  if (profile && !initialized) {
    setDisplayName(profile.display_name ?? '')
    setAge(profile.age?.toString() ?? '')
    setGender(profile.gender ?? '')
    setHeightCm(profile.height_cm?.toString() ?? '')
    setWeightKg(profile.weight_kg?.toString() ?? '')
    setActivityLevel(profile.activity_level ?? '')
    setDietGoal(profile.diet_goal ?? '')
    setCalorieGoal(profile.calorie_goal?.toString() ?? '2000')
    setBodyFatPct(profile.body_fat_pct?.toString() ?? '')
    setPacePct(profile.pace_pct?.toString() ?? '0.5')
    setInitialized(true)
  }

  // プロフィール更新
  const updateMutation = useMutation({
    mutationFn: (data: ProfileUpdate) => updateProfile(data),
    onSuccess: (res) => {
      queryClient.setQueryData(['profile'], res.data)
      setCalorieGoal(res.data.calorie_goal?.toString() ?? '2000')
      // 保存完了後、プロフィールのPFCを表示（AI提案があれば上書き）
      if (!suggestedPfc && res.data.recommended_pfc) {
        setSuggestedPfc(res.data.recommended_pfc)
      }
      queryClient.invalidateQueries({ queryKey: ['dynamic-tdee'] })
      toast.success('プロフィールを保存しました')
    },
    onError: () => toast.error('保存に失敗しました'),
  })

  // AI提案
  const suggestMutation = useMutation({
    mutationFn: suggestCalorieGoal,
    onSuccess: (res) => {
      const { calorie_goal, reason, recommended_pfc } = res.data
      setCalorieGoal(calorie_goal.toString())
      if (recommended_pfc) setSuggestedPfc(recommended_pfc)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success(`AI提案: ${calorie_goal} kcal\n${reason}`, { duration: 5000 })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'AI提案に失敗しました'
      toast.error(msg)
    },
  })

  const handleSave = () => {
    const data: ProfileUpdate = {}
    if (displayName)   data.display_name   = displayName
    if (age)           data.age            = parseInt(age)
    if (gender)        data.gender         = gender as ProfileUpdate['gender']
    if (heightCm)      data.height_cm      = parseFloat(heightCm)
    if (weightKg)      data.weight_kg      = parseFloat(weightKg)
    if (activityLevel) data.activity_level = activityLevel as ProfileUpdate['activity_level']
    if (dietGoal)      data.diet_goal      = dietGoal as ProfileUpdate['diet_goal']
    if (calorieGoal)   data.calorie_goal   = parseInt(calorieGoal)
    if (bodyFatPct)    data.body_fat_pct   = parseFloat(bodyFatPct)
    if (pacePct)       data.pace_pct       = parseFloat(pacePct)
    updateMutation.mutate(data)
  }

  // 表示するPFC（AI提案 > プロフィール保存済み > null）
  const displayPfc = suggestedPfc ?? profile?.recommended_pfc ?? null

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center gap-2">
        <User className="text-green-600" size={22} />
        <h2 className="text-lg font-bold text-gray-800">プロフィール設定</h2>
      </div>

      {/* カロリー目標カード */}
      <CalorieGoalCard
        calorieGoal={parseInt(calorieGoal) || profile?.calorie_goal || 2000}
        onSuggest={() => suggestMutation.mutate()}
        isSuggesting={suggestMutation.isPending}
      />

      {/* 推奨PFCカード（プロフィール保存 or AI提案後に表示） */}
      {displayPfc && <RecommendedPfcCard pfc={displayPfc} />}

      {/* 基本情報 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-green-500" />
          <span className="font-semibold text-gray-700 text-sm">基本情報</span>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="表示名"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="年齢" value={age} onChange={setAge}
            unit="歳" placeholder="30" min={10} max={100} />
          <SelectField label="性別" value={gender} onChange={setGender}
            options={[
              { value: 'male',   label: '男性' },
              { value: 'female', label: '女性' },
              { value: 'other',  label: 'その他' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="身長" value={heightCm} onChange={setHeightCm}
            unit="cm" placeholder="170" min={100} max={250} />
          <NumberField label="体重（基準値）" value={weightKg} onChange={setWeightKg}
            unit="kg" placeholder="65" min={30} max={200} />
        </div>

        <NumberField label="体脂肪率（LBMベースPFC算出に使用）" value={bodyFatPct} onChange={setBodyFatPct}
          unit="%" placeholder="20" min={3} max={60} />
      </div>

      {/* 活動・目標設定 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Target size={16} className="text-orange-500" />
          <span className="font-semibold text-gray-700 text-sm">活動レベル・目標</span>
        </div>

        <SelectField label="活動レベル" value={activityLevel} onChange={setActivityLevel}
          options={[
            { value: 'sedentary',  label: '🪑 ほぼ座りっぱなし' },
            { value: 'lightly',    label: '🚶 軽い運動（週1〜3回）' },
            { value: 'moderately', label: '🏃 適度な運動（週3〜5回）' },
            { value: 'very',       label: '💪 活発な運動（週6〜7回）' },
            { value: 'super',      label: '🔥 非常に活発（肉体労働など）' },
          ]}
        />

        <SelectField label="ダイエット目標" value={dietGoal} onChange={setDietGoal}
          options={[
            { value: 'lose',     label: '⬇️ 体重を減らしたい' },
            { value: 'maintain', label: '➡️ 体重を維持したい' },
            { value: 'gain',     label: '⬆️ 体重を増やしたい（増量）' },
          ]}
        />

        <NumberField
          label="1日カロリー目標（手動で変更する場合）"
          value={calorieGoal}
          onChange={setCalorieGoal}
          unit="kcal" placeholder="2000" min={1000} max={5000}
        />

        <SelectField label="目標減量ペース（週あたり体重比）" value={pacePct} onChange={setPacePct}
          options={PACE_OPTIONS}
        />
      </div>

      {/* 動的TDEEカード */}
      {dynamicTdee && <DynamicTdeeCard tdee={dynamicTdee} />}

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold
                   hover:bg-green-700 disabled:opacity-50 flex items-center
                   justify-center gap-2 transition-colors"
      >
        {updateMutation.isPending
          ? <><Loader2 size={16} className="animate-spin" />保存中...</>
          : <><Save size={16} />プロフィールを保存する</>
        }
      </button>

      <p className="text-xs text-gray-400 text-center pb-4">
        プロフィールを保存するとTDEE（総消費カロリー）からカロリー目標と推奨PFCが自動計算されます。<br />
        AIボタンで Gemma 4 がさらに詳細な提案を行います。
      </p>
    </div>
  )
}
