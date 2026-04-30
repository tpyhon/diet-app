import { useState, useEffect } from "react";
import { getMe, updateProfile } from "../api";
import type { UserProfile } from "../api";

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:   "ほぼ運動しない（デスクワーク中心）",
  light:       "軽い運動（週1〜2回）",
  moderate:    "中程度の運動（週3〜5回）",
  active:      "激しい運動（週6〜7回）",
  very_active: "非常に激しい運動（肉体労働など）",
};

const GOAL_LABELS: Record<string, string> = {
  lose:     "体重を減らす（-500 kcal/日）",
  maintain: "体重を維持する",
  gain:     "体重を増やす（+300 kcal/日）",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({
    age: "",
    gender: "",
    height_cm: "",
    current_weight_kg: "",
    activity_level: "",
    goal: "",
    calorie_goal: "",
  });
  const [manualCalorie, setManualCalorie] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe().then((p) => {
      setProfile(p);
      setForm({
        age: p.age?.toString() ?? "",
        gender: p.gender ?? "",
        height_cm: p.height_cm?.toString() ?? "",
        current_weight_kg: p.current_weight_kg?.toString() ?? "",
        activity_level: p.activity_level ?? "",
        goal: p.goal ?? "",
        calorie_goal: p.calorie_goal?.toString() ?? "2000",
      });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const payload: Record<string, number | string> = {};
    if (form.age) payload.age = parseInt(form.age);
    if (form.gender) payload.gender = form.gender;
    if (form.height_cm) payload.height_cm = parseFloat(form.height_cm);
    if (form.current_weight_kg) payload.current_weight_kg = parseFloat(form.current_weight_kg);
    if (form.activity_level) payload.activity_level = form.activity_level;
    if (form.goal) payload.goal = form.goal;
    if (manualCalorie && form.calorie_goal) payload.calorie_goal = parseInt(form.calorie_goal);

    try {
      const updated = await updateProfile(payload);
      setProfile(updated);
      setForm((f) => ({ ...f, calorie_goal: updated.calorie_goal.toString() }));
      setMessage(`✅ 保存しました！カロリー目標: ${updated.calorie_goal} kcal/日`);
    } catch {
      setMessage("❌ 保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
        <p className="text-gray-400 text-sm mb-6">
          個人情報を入力すると、Harris-Benedict式でカロリー目標が自動計算されます。
        </p>

        <div className="space-y-4 bg-gray-800 rounded-2xl p-6">

          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>年齢</label>
              <input type="number" className={inputClass} placeholder="30"
                value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>性別</label>
              <select className={inputClass}
                value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>身長（cm）</label>
              <input type="number" className={inputClass} placeholder="170"
                value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>体重（kg）</label>
              <input type="number" className={inputClass} placeholder="65"
                value={form.current_weight_kg}
                onChange={(e) => setForm({ ...form, current_weight_kg: e.target.value })} />
            </div>
          </div>

          {/* 活動量 */}
          <div>
            <label className={labelClass}>活動レベル</label>
            <select className={inputClass}
              value={form.activity_level}
              onChange={(e) => setForm({ ...form, activity_level: e.target.value })}>
              <option value="">選択</option>
              {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* 目標 */}
          <div>
            <label className={labelClass}>目標</label>
            <select className={inputClass}
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}>
              <option value="">選択</option>
              {Object.entries(GOAL_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* カロリー目標 */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + " mb-0"}>カロリー目標（kcal/日）</label>
              <button
                className="text-xs text-emerald-400 underline"
                onClick={() => setManualCalorie(!manualCalorie)}>
                {manualCalorie ? "自動計算に戻す" : "手動で設定する"}
              </button>
            </div>
            {manualCalorie ? (
              <input type="number" className={inputClass}
                value={form.calorie_goal}
                onChange={(e) => setForm({ ...form, calorie_goal: e.target.value })} />
            ) : (
              <div className="rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-3 text-center">
                <span className="text-3xl font-bold text-emerald-400">
                  {profile?.calorie_goal ?? 2000}
                </span>
                <span className="text-gray-400 text-sm ml-1">kcal / 日（自動計算）</span>
              </div>
            )}
          </div>

          {/* 保存ボタン */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition disabled:opacity-50">
            {saving ? "保存中..." : "保存する"}
          </button>

          {message && (
            <p className="text-center text-sm mt-2 text-emerald-300">{message}</p>
          )}
        </div>

        {/* 計算式の説明 */}
        <div className="mt-4 rounded-xl bg-gray-800/60 p-4 text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-1">📐 計算方法（Harris-Benedict改訂式）</p>
          <p>BMR（基礎代謝）× 活動係数 = TDEE（消費カロリー）</p>
          <p className="mt-1">目標: 減量 −500 kcal ／ 維持 ±0 ／ 増量 +300 kcal</p>
        </div>
      </div>
    </div>
  );
}
