// frontend/src/pages/WalkingPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import {
  fetchWalkingSessions, createWalkingSession, deleteWalkingSession,
  fetchCyclingSessions, createCyclingSession, deleteCyclingSession,
  fetchProfile,
} from '../api'
import type { WalkingSession, CyclingSession } from '../api'
import { fixLeafletIcons, startIcon, endIcon } from '../utils/leafletIcons'
import toast from 'react-hot-toast'
import {
  Footprints, Bike, MapPin,
  Loader2, ChevronUp, Map, Plus, Trash2, Activity,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'

fixLeafletIcons()

type ExerciseType = 'walking' | 'cycling'

interface GPSPoint {
  lat: number
  lng: number
  timestamp: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDistance(km: number): string {
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(km * 1000)} m`
}

/** 速度(km/h)からMETs値を返す（walking.pyと同じ線形補間ロジック） */
function speedToMets(speedKmh: number): number {
  const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) =>
    y0 + (x - x0) / (x1 - x0) * (y1 - y0)
  if (speedKmh <= 3.2) return 2.8
  if (speedKmh < 4.8)  return lerp(speedKmh, 3.2, 4.8, 2.8, 3.5)
  if (speedKmh < 6.4)  return lerp(speedKmh, 4.8, 6.4, 3.5, 4.3)
  if (speedKmh < 8.0)  return lerp(speedKmh, 6.4, 8.0, 4.3, 5.0)
  return Math.min(5.0 + (speedKmh - 8.0) * 0.5, 8.0)
}

/** 距離・時間・体重からMETs基準で消費カロリーを計算する（ウォーキング） */
function calcWalkingCalories(distanceKm: number, durationMin: number, weightKg = 65): number {
  if (durationMin <= 0 || distanceKm <= 0) return 0
  const speedKmh = distanceKm / (durationMin / 60)
  const mets     = speedToMets(speedKmh)
  return Math.round(mets * weightKg * (durationMin / 60) * 1.05)
}

const CYCLING_DEFAULT_SPEED_KMH = 15.0  // 距離のみ入力時のデフォルト巡航速度（backend/app/routers/cycling.pyと同値）
const CYCLING_METS               = 5.8  // 適用強度（backend/app/routers/cycling.pyと同値）

/** 時間・体重からMETs基準で消費カロリーを計算する（サイクリング） */
function calcCyclingCalories(durationMin: number, weightKg = 65): number {
  if (durationMin <= 0) return 0
  return Math.round(CYCLING_METS * weightKg * (durationMin / 60) * 1.05)
}

// ウォーキングは歩数しか分からないユーザーが大半のため、歩数から距離・時間を推定する
// （backend/app/routers/walking.pyの estimate_distance_km_from_steps / estimate_duration_min_from_steps と同値）
const DEFAULT_HEIGHT_CM  = 165  // 身長未設定時に仮定する身長
const STEP_LENGTH_RATIO  = 0.45 // 歩幅 = 身長 × この比率
const STEP_PITCH_PER_MIN = 100  // 歩数から時間を推定する際のピッチ(歩/分)

function estimateDistanceKmFromSteps(steps: number, heightCm: number): number {
  const strideM = heightCm * STEP_LENGTH_RATIO / 100
  return (steps * strideM) / 1000
}

function estimateDurationMinFromSteps(steps: number): number {
  return steps / STEP_PITCH_PER_MIN
}


// ─── 過去セッションカード ────────────────────────────────────
function SessionCard({
  type,
  session,
  onDelete,
}: {
  type: ExerciseType
  session: WalkingSession | CyclingSession
  onDelete: () => void
}) {
  const [showMap, setShowMap]             = useState(false)
  const [route, setRoute]                 = useState<GPSPoint[]>([])
  const [loadingRoute, setLoadingRoute]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const routeJson = type === 'walking' ? (session as WalkingSession).route_json : undefined
  const hasRoute  = type === 'walking' && !!routeJson && routeJson !== '[]'

  const handleShowMap = async () => {
    if (!showMap && route.length === 0) {
      setLoadingRoute(true)
      try {
        const res  = await fetch(`/api/walking/${session.id}/route`)
        const data = await res.json()
        setRoute(data.route ?? [])
      } catch {
        toast.error('ルートの取得に失敗しました')
      } finally {
        setLoadingRoute(false)
      }
    }
    setShowMap(v => !v)
  }

  const center: [number, number] | undefined =
    route.length > 0 ? [route[0].lat, route[0].lng] : undefined
  const polylinePoints: [number, number][] = route.map(p => [p.lat, p.lng])

  const TypeIcon  = type === 'walking' ? Footprints : Bike
  const typeColor = type === 'walking' ? 'text-cyan-500' : 'text-orange-500'

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <TypeIcon size={14} className={typeColor} />
            {new Date(session.start_time).toLocaleDateString('ja-JP', {
              month: 'short', day: 'numeric', weekday: 'short',
            })}
          </span>
          <div className="flex items-center gap-2">
            {session.end_time && (
              <span className="text-xs text-gray-400">
                {new Date(session.start_time).toLocaleTimeString('ja-JP', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-500">削除する？</span>
                <button
                  onClick={onDelete}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600"
                >はい</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg"
                >いいえ</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-cyan-50 rounded-xl py-2">
            <p className="text-lg font-bold text-cyan-600">
              {formatDistance(session.distance_km ?? 0)}
            </p>
            <p className="text-xs text-gray-400">距離</p>
          </div>
          <div className="text-center bg-green-50 rounded-xl py-2">
            <p className="text-lg font-bold text-green-600">
              {formatDuration(Math.round((session.duration_minutes ?? 0) * 60))}
            </p>
            <p className="text-xs text-gray-400">時間</p>
          </div>
          <div className="text-center bg-orange-50 rounded-xl py-2">
            <p className="text-lg font-bold text-orange-500">
              {Math.round(session.estimated_calories ?? 0)}
            </p>
            <p className="text-xs text-gray-400">kcal</p>
          </div>
        </div>
        {session.avg_speed_kmh != null && session.avg_speed_kmh > 0 && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            平均速度 {session.avg_speed_kmh.toFixed(1)} km/h
          </p>
        )}
      </div>

      {hasRoute && (
        <button
          onClick={handleShowMap}
          className="w-full flex items-center justify-center gap-2 py-2.5
                     bg-gray-50 border-t border-gray-100 text-xs text-gray-500
                     hover:bg-gray-100 transition-colors"
        >
          {loadingRoute
            ? <Loader2 size={14} className="animate-spin" />
            : showMap
            ? <><ChevronUp size={14} />地図を閉じる</>
            : <><Map size={14} />コースを見る</>
          }
        </button>
      )}

      {showMap && center && (
        <div className="h-52 px-3 pb-3">
          <MapContainer
            center={center} zoom={15}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polylinePoints.length > 0 && (
              <>
                <Polyline positions={polylinePoints} color="#06b6d4" weight={4} opacity={0.8} />
                <Marker position={polylinePoints[0]} icon={startIcon}>
                  <Popup>スタート</Popup>
                </Marker>
                <Marker position={polylinePoints[polylinePoints.length - 1]} icon={endIcon}>
                  <Popup>ゴール</Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        </div>
      )}
    </div>
  )
}


function todayDateString(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// ─── 手動入力フォーム（ウォーキング／サイクリング選択式） ─────
function ManualEntryForm() {
  const [show, setShow]                 = useState(false)
  const [exerciseType, setExerciseType] = useState<ExerciseType>('walking')
  const [date, setDate]                 = useState(todayDateString)
  const [steps, setSteps]               = useState('')     // ウォーキング（歩数のみ）
  const [distance, setDistance]         = useState('')     // サイクリング
  const [duration, setDuration]         = useState('')     // サイクリング（任意）
  const [notes, setNotes]               = useState('')
  const queryClient                     = useQueryClient()

  // 歩数→距離の推定に使う身長（未設定ならbackendと同じ165cmを仮定）
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile().then(r => r.data),
  })
  const heightCm = profile?.height_cm ?? DEFAULT_HEIGHT_CM

  const resetForm = () => {
    setShow(false)
    setSteps(''); setDistance(''); setDuration(''); setNotes('')
    setDate(todayDateString())
  }

  const walkingMutation = useMutation({
    mutationFn: createWalkingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walkingSessions'] })
      toast.success('ウォーキングを記録しました！')
      resetForm()
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const cyclingMutation = useMutation({
    mutationFn: createCyclingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclingSessions'] })
      toast.success('サイクリングを記録しました！')
      resetForm()
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const mutation = exerciseType === 'walking' ? walkingMutation : cyclingMutation

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) { toast.error('日付を入力してください'); return }

    if (exerciseType === 'walking') {
      const stepsNum = parseInt(steps, 10)
      if (isNaN(stepsNum) || stepsNum <= 0) { toast.error('歩数を入力してください'); return }
      walkingMutation.mutate({
        start_time:   `${date}T00:00:00`,
        route_points: [],
        steps:        stepsNum,
        notes:        notes || undefined,
      })
      return
    }

    const dist = parseFloat(distance)
    if (isNaN(dist) || dist <= 0) { toast.error('距離を入力してください'); return }
    const dur = parseFloat(duration)
    const effectiveMinutes = (!isNaN(dur) && dur > 0) ? dur : (dist / CYCLING_DEFAULT_SPEED_KMH) * 60
    const startDt = new Date(`${date}T00:00:00`)
    const endDt   = new Date(startDt.getTime() + effectiveMinutes * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    cyclingMutation.mutate({
      start_time:              toLocal(startDt),
      end_time:                toLocal(endDt),
      distance_km:             dist,
      manual_duration_minutes: (!isNaN(dur) && dur > 0) ? dur : undefined,
      notes:                   notes || undefined,
    })
  }

  // ── プレビュー ──
  const stepsNum   = parseInt(steps, 10)
  const hasSteps    = !isNaN(stepsNum) && stepsNum > 0
  const estDistanceKm  = hasSteps ? estimateDistanceKmFromSteps(stepsNum, heightCm) : 0
  const estDurationMin = hasSteps ? estimateDurationMinFromSteps(stepsNum) : 0

  const dist = parseFloat(distance)
  const dur  = parseFloat(duration)
  const hasDistance = !isNaN(dist) && dist > 0
  const hasDuration = !isNaN(dur) && dur > 0
  const effectiveDur   = hasDuration ? dur : (hasDistance ? (dist / CYCLING_DEFAULT_SPEED_KMH) * 60 : 0)
  const effectiveSpeed = hasDuration ? dist / (dur / 60) : CYCLING_DEFAULT_SPEED_KMH

  const previewCalories = exerciseType === 'walking'
    ? (hasSteps ? calcWalkingCalories(estDistanceKm, estDurationMin) : null)
    : (hasDistance ? calcCyclingCalories(effectiveDur) : null)

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-400
                   rounded-2xl text-sm hover:border-gray-300 hover:text-gray-500
                   transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />過去の運動を手動で入力する
      </button>
    )
  }

  // Tailwindは動的クラス名（`text-${color}-500`等）を検出できないため、
  // 種目ごとの完全なクラス文字列をリテラルで持つテーマオブジェクトを使う。
  const THEME = {
    walking: {
      icon:        'text-cyan-500',
      ring:        'focus:ring-cyan-400',
      previewBg:   'bg-cyan-50',
      previewText: 'text-cyan-700',
      previewSub:  'text-cyan-400',
      btn:         'bg-cyan-500 hover:bg-cyan-600',
    },
    cycling: {
      icon:        'text-orange-500',
      ring:        'focus:ring-orange-400',
      previewBg:   'bg-orange-50',
      previewText: 'text-orange-700',
      previewSub:  'text-orange-400',
      btn:         'bg-orange-500 hover:bg-orange-600',
    },
  } as const
  const theme = THEME[exerciseType]

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <Activity size={18} className={theme.icon} />過去の記録を入力
      </h3>

      {/* 種目選択 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setExerciseType('walking')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                      border-2 transition-colors
                      ${exerciseType === 'walking'
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-600'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
        >
          <Footprints size={16} />ウォーキング
        </button>
        <button
          type="button"
          onClick={() => setExerciseType('cycling')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                      border-2 transition-colors
                      ${exerciseType === 'cycling'
                        ? 'border-orange-400 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
        >
          <Bike size={16} />サイクリング
        </button>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">日付</label>
        <input
          type="date"
          value={date}
          max={todayDateString()}
          onChange={e => setDate(e.target.value)}
          className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                     focus:outline-none focus:ring-2 ${theme.ring}`}
        />
      </div>

      {exerciseType === 'walking' ? (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">歩数 *</label>
          <div className="relative">
            <input
              type="number" step="1" min="0" placeholder="例：8000"
              value={steps} onChange={e => setSteps(e.target.value)}
              className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                         focus:outline-none focus:ring-2 ${theme.ring} pr-10`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">歩</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">身長から歩幅を推定し、距離・時間を自動算出します</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">距離 (km) *</label>
            <div className="relative">
              <input
                type="number" step="0.1" min="0" placeholder="例：20.0"
                value={distance} onChange={e => setDistance(e.target.value)}
                className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                           focus:outline-none focus:ring-2 ${theme.ring} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">km</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">時間 (分)　任意</label>
            <div className="relative">
              <input
                type="number" step="1" min="0" placeholder="不明なら空欄"
                value={duration} onChange={e => setDuration(e.target.value)}
                className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                           focus:outline-none focus:ring-2 ${theme.ring} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">メモ（任意）</label>
        <input
          type="text" placeholder="例：公園コース"
          value={notes} onChange={e => setNotes(e.target.value)}
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 ${theme.ring}`}
        />
      </div>

      {previewCalories !== null && exerciseType === 'walking' && (
        <div className={`${theme.previewBg} rounded-xl px-4 py-3 text-sm ${theme.previewText}`}>
          推定消費カロリー：約
          <span className="font-bold mx-1">{previewCalories}</span>
          kcal
          <span className={`text-xs ${theme.previewSub} ml-2`}>
            （推定距離 {estDistanceKm.toFixed(2)}km・推定時間 {Math.round(estDurationMin)}分）
          </span>
        </div>
      )}

      {previewCalories !== null && exerciseType === 'cycling' && (
        <div className={`${theme.previewBg} rounded-xl px-4 py-3 text-sm ${theme.previewText}`}>
          推定消費カロリー：約
          <span className="font-bold mx-1">{previewCalories}</span>
          kcal
          <span className={`text-xs ${theme.previewSub} ml-2`}>
            （{effectiveSpeed.toFixed(1)} km/h{!hasDuration && '・推定'}）
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setShow(false)}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
          キャンセル
        </button>
        <button type="submit" disabled={mutation.isPending}
          className={`flex-1 py-3 rounded-xl ${theme.btn} text-white text-sm font-semibold
                     disabled:opacity-50 flex items-center justify-center gap-2`}>
          {mutation.isPending
            ? <><Loader2 size={16} className="animate-spin" />保存中...</>
            : '記録する'}
        </button>
      </div>
    </form>
  )
}


// ─── メインページ ────────────────────────────────────────────
export default function WalkingPage() {
  const queryClient = useQueryClient()

  const { data: walkingSessions = [] } = useQuery<WalkingSession[]>({
    queryKey: ['walkingSessions'],
    queryFn: () => fetchWalkingSessions().then(r => r.data),
  })
  const { data: cyclingSessions = [] } = useQuery<CyclingSession[]>({
    queryKey: ['cyclingSessions'],
    queryFn: () => fetchCyclingSessions().then(r => r.data),
  })

  const deleteWalkingMutation = useMutation({
    mutationFn: deleteWalkingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walkingSessions'] })
      toast.success('削除しました')
    },
    onError: () => toast.error('削除に失敗しました'),
  })
  const deleteCyclingMutation = useMutation({
    mutationFn: deleteCyclingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclingSessions'] })
      toast.success('削除しました')
    },
    onError: () => toast.error('削除に失敗しました'),
  })

  // ウォーキング・サイクリングを合成し、開始時刻の新しい順に並べる
  const records = [
    ...walkingSessions.map(s => ({ type: 'walking' as const, session: s })),
    ...cyclingSessions.map(s => ({ type: 'cycling' as const, session: s })),
  ].sort((a, b) => new Date(b.session.start_time).getTime() - new Date(a.session.start_time).getTime())

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <Activity className="text-cyan-500" size={22} />運動
      </h2>

      <ManualEntryForm />

      {records.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
            <MapPin size={16} className="text-cyan-400" />
            <span>過去の運動記録</span>
          </div>
          {records.map(({ type, session }) => (
            <SessionCard
              key={`${type}-${session.id}`}
              type={type}
              session={session}
              onDelete={() => {
                if (type === 'walking') deleteWalkingMutation.mutate(session.id)
                else deleteCyclingMutation.mutate(session.id)
              }}
            />
          ))}
        </div>
      )}

      {records.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Activity size={48} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">まだ運動の記録がありません</p>
          <p className="text-xs mt-1">上のフォームから記録を追加しましょう</p>
        </div>
      )}
    </div>
  )
}
