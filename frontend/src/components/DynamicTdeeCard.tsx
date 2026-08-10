// frontend/src/components/DynamicTdeeCard.tsx
import type { RecommendedPfc, DynamicTdeeResult } from '../api'
import { Sparkles, Gauge, ShieldAlert, BatteryLow } from 'lucide-react'

// ── 推奨PFCカードコンポーネント ──────────────────────────────
export function RecommendedPfcCard({ pfc }: { pfc: RecommendedPfc }) {
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

// ── 動的TDEEカードコンポーネント ─────────────────────────────
export function DynamicTdeeCard({ tdee }: { tdee: DynamicTdeeResult }) {
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

      {tdee.metabolic_alert?.has_alert && (
        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
          <BatteryLow size={16} className="text-indigo-500 mt-0.5 shrink-0" />
          <div className="text-xs text-indigo-700">
            <p className="font-semibold mb-0.5">{tdee.metabolic_alert.title}</p>
            <p className="text-indigo-500">{tdee.metabolic_alert.message}</p>
          </div>
        </div>
      )}

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
