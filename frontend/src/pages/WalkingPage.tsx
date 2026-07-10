// frontend/src/pages/WalkingPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import { fetchWalkingSessions, createWalkingSession, deleteWalkingSession } from '../api'
import type { WalkingSession } from '../api'
import { fixLeafletIcons, startIcon, endIcon } from '../utils/leafletIcons'
import { toJSTISOString, nowJSTString } from '../utils/datetime'
import toast from 'react-hot-toast'
import {
  Footprints, Play, Square, MapPin,
  Clock, Zap, Navigation, Loader2,
  ChevronDown, ChevronUp, Map, Plus, Trash2,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'

fixLeafletIcons()

interface GPSPoint {
  lat: number
  lng: number
  timestamp: string
}

function MapFollower({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, map.getZoom())
  }, [position, map])
  return null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDistance(km: number): string {
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(km * 1000)} m`
}

function haversineKm(p1: GPSPoint, p2: GPSPoint): number {
  const R    = 6371
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
    Math.cos((p2.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/** 速度(km/h)からMETs値を返す（walking.pyと同じロジック） */
function speedToMets(speedKmh: number): number {
  if (speedKmh < 3.2) return 2.8
  if (speedKmh < 4.8) return 3.5
  if (speedKmh < 6.4) return 4.3
  return 5.0
}

/** 距離・時間・体重からMETs基準で消費カロリーを計算する */
function calcWalkingCalories(
  distanceKm: number,
  durationMin: number,
  weightKg = 65,
): number {
  if (durationMin <= 0 || distanceKm <= 0) return 0
  const speedKmh = distanceKm / (durationMin / 60)
  const mets     = speedToMets(speedKmh)
  return Math.round(mets * weightKg * (durationMin / 60) * 1.05)
}


// ─── 過去セッションカード ────────────────────────────────────
function SessionCard({
  session,
  onDelete,
}: {
  session: WalkingSession
  onDelete: (id: number) => void
}) {
  const [showMap, setShowMap]           = useState(false)
  const [route, setRoute]               = useState<GPSPoint[]>([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
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
                  onClick={() => onDelete(session.id)}
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

      {session.route_json !== '[]' && (
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


const DEFAULT_SPEED_KMH = 5.5  // 時間不明時のカロリー推定デフォルト速度（バックエンドと同値）

function todayDateString(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// ─── 手動入力フォーム ────────────────────────────────────────
function ManualEntryForm() {
  const [show, setShow]         = useState(false)
  const [date, setDate]         = useState(todayDateString)
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes]       = useState('')
  const queryClient             = useQueryClient()

  const mutation = useMutation({
    mutationFn: createWalkingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walkingSessions'] })
      toast.success('ウォーキングを記録しました！')
      setShow(false)
      setDistance(''); setDuration(''); setNotes('')
      setDate(todayDateString())
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dist = parseFloat(distance)
    if (isNaN(dist) || dist <= 0) { toast.error('距離を入力してください'); return }
    if (!date) { toast.error('日付を入力してください'); return }

    const dur = parseFloat(duration)
    const effectiveMinutes = (!isNaN(dur) && dur > 0)
      ? dur
      : (dist / DEFAULT_SPEED_KMH) * 60
    const startDt = new Date(`${date}T00:00:00`)
    const endDt   = new Date(startDt.getTime() + effectiveMinutes * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    mutation.mutate({
      start_time:              toLocal(startDt),
      end_time:                toLocal(endDt),
      route_points:            [],
      manual_distance_km:      dist,
      manual_duration_minutes: (!isNaN(dur) && dur > 0) ? dur : undefined,
      notes:                   notes || undefined,
    })
  }

  // 距離が入力されていれば（時間不明でも）カロリーをプレビュー
  const dist = parseFloat(distance)
  const dur  = parseFloat(duration)
  const hasDistance = !isNaN(dist) && dist > 0
  const hasDuration = !isNaN(dur) && dur > 0
  const effectiveDur   = hasDuration ? dur : (hasDistance ? (dist / DEFAULT_SPEED_KMH) * 60 : 0)
  const effectiveSpeed = hasDuration ? dist / (dur / 60) : DEFAULT_SPEED_KMH
  const previewCalories = hasDistance ? calcWalkingCalories(dist, effectiveDur) : null

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-400
                   rounded-2xl text-sm hover:border-gray-300 hover:text-gray-500
                   transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />過去のウォーキングを手動で入力する
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <Footprints size={18} className="text-cyan-500" />過去の記録を入力
      </h3>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">日付</label>
        <input
          type="date"
          value={date}
          max={todayDateString()}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">距離 (km) *</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="0" placeholder="例：5.0"
              value={distance} onChange={e => setDistance(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10"
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
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">メモ（任意）</label>
        <input
          type="text" placeholder="例：公園コース"
          value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      {previewCalories !== null && (
        <div className="bg-cyan-50 rounded-xl px-4 py-3 text-sm text-cyan-700">
          推定消費カロリー：約
          <span className="font-bold mx-1">{previewCalories}</span>
          kcal
          <span className="text-xs text-cyan-400 ml-2">
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
          className="flex-1 py-3 rounded-xl bg-cyan-500 text-white text-sm font-semibold
                     hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
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
  const [isTracking, setIsTracking]       = useState(false)
  const [currentPos, setCurrentPos]       = useState<[number, number] | null>(null)
  const [routePoints, setRoutePoints]     = useState<GPSPoint[]>([])
  const [startTime, setStartTime]         = useState<Date | null>(null)
  const [elapsed, setElapsed]             = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [notes, setNotes]                 = useState('')

  const watchIdRef  = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteWalkingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walkingSessions'] })
      toast.success('削除しました')
    },
    onError: () => toast.error('削除に失敗しました'),
  })

  const { data: sessions = [] } = useQuery<WalkingSession[]>({
    queryKey: ['walkingSessions'],
    queryFn: () => fetchWalkingSessions().then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: createWalkingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walkingSessions'] })
      toast.success('ウォーキングを記録しました！🎉')
    },
    onError: () => toast.error('記録に失敗しました'),
  })

  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isTracking])

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('このデバイスはGPSに対応していません')
      return
    }
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        toast('画面スリープを無効化しました 🔆', { icon: '🔆', duration: 2000 })
      } catch (err) {
        console.log('Wake Lock not available:', err)
      }
    }
    setRoutePoints([])
    setTotalDistance(0)
    setElapsed(0)
    setStartTime(new Date())
    setIsTracking(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPoint: GPSPoint = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          timestamp: nowJSTString(),   // ← JST時刻で記録
        }
        setCurrentPos([pos.coords.latitude, pos.coords.longitude])
        setRoutePoints(prev => {
          if (prev.length > 0) {
            const dist = haversineKm(prev[prev.length - 1], newPoint)
            if (dist > 0.005) {
              setTotalDistance(d => d + dist)
              return [...prev, newPoint]
            }
            return prev
          }
          return [newPoint]
        })
      },
      (err) => {
        console.error(err)
        toast.error('GPS取得に失敗しました。位置情報の許可を確認してください。')
        stopTracking()
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [])

  const stopTracking = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)

    if (routePoints.length < 2 || !startTime) {
      toast('記録が短すぎます（もう少し歩いてください）', { icon: '⚠️' })
      return
    }

    // ← toJSTISOString でJST時刻をそのまま送信
    saveMutation.mutate({
      start_time:   toJSTISOString(startTime),
      end_time:     nowJSTString(),
      route_points: routePoints,
      notes:        notes || undefined,
    })
    setNotes('')
  }, [routePoints, startTime, notes, saveMutation])

  const currentSpeed = elapsed > 0
    ? parseFloat(((totalDistance / elapsed) * 3600).toFixed(1))
    : 0

  // リアルタイム消費カロリー（METs方式）
  const currentCalories = calcWalkingCalories(
    totalDistance,
    elapsed / 60,
  )

  const polylinePoints: [number, number][] = routePoints.map(p => [p.lat, p.lng])

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <Footprints className="text-cyan-500" size={22} />ウォーキング
      </h2>

      {isTracking ? (
        <div className="space-y-4">
          {/* リアルタイム地図 */}
          <div className="h-64 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {currentPos ? (
              <MapContainer
                center={currentPos} zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapFollower position={currentPos} />
                {polylinePoints.length > 1 && (
                  <Polyline positions={polylinePoints} color="#06b6d4" weight={5} opacity={0.9} />
                )}
                {polylinePoints.length > 0 && (
                  <Marker position={polylinePoints[0]} icon={startIcon}>
                    <Popup>スタート地点</Popup>
                  </Marker>
                )}
                {currentPos && (
                  <Marker position={currentPos}>
                    <Popup>現在地</Popup>
                  </Marker>
                )}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                  <Loader2 size={28} className="animate-spin mx-auto mb-2 text-cyan-400" />
                  <p className="text-sm">GPS取得中...</p>
                </div>
              </div>
            )}
          </div>

          {/* リアルタイム統計 */}
          <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-2xl p-4 text-white shadow-md">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white/20 rounded-xl py-3 text-center">
                <p className="text-2xl font-bold">{formatDuration(elapsed)}</p>
                <p className="text-xs text-white/70 flex items-center justify-center gap-1">
                  <Clock size={11} />経過時間
                </p>
              </div>
              <div className="bg-white/20 rounded-xl py-3 text-center">
                <p className="text-2xl font-bold">{formatDistance(totalDistance)}</p>
                <p className="text-xs text-white/70 flex items-center justify-center gap-1">
                  <Navigation size={11} />距離
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 rounded-xl py-3 text-center">
                <p className="text-2xl font-bold">{currentSpeed}</p>
                <p className="text-xs text-white/70">km/h</p>
              </div>
              <div className="bg-white/20 rounded-xl py-3 text-center">
                <p className="text-2xl font-bold">{currentCalories}</p>
                <p className="text-xs text-white/70 flex items-center justify-center gap-1">
                  <Zap size={11} />kcal
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white rounded-xl px-4 py-2 shadow-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>GPS記録中 — {routePoints.length} ポイント取得</span>
          </div>

          <input
            type="text"
            placeholder="メモ（任意）例：公園コース"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

          <button
            onClick={stopTracking}
            disabled={saveMutation.isPending}
            className="w-full py-4 bg-red-500 text-white rounded-2xl text-base font-bold
                       hover:bg-red-600 active:scale-95 transition-all shadow-md
                       flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? <><Loader2 size={20} className="animate-spin" />保存中...</>
              : <><Square size={20} fill="white" />ウォーキングを終了・保存</>
            }
          </button>
        </div>

      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-4">
            <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto">
              <Footprints size={40} className="text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">ウォーキングを開始</p>
              <p className="text-xs text-gray-400">
                GPSで距離・コース・消費カロリーを自動記録します<br />
                スマホの位置情報を許可してください
              </p>
            </div>
            <button
              onClick={startTracking}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600
                         text-white rounded-2xl text-base font-bold
                         hover:from-cyan-600 hover:to-cyan-700
                         active:scale-95 transition-all shadow-md
                         flex items-center justify-center gap-2"
            >
              <Play size={20} fill="white" />スタート
            </button>
            <p className="text-xs text-gray-300">※ 屋外での使用を推奨します</p>
          </div>

          <ManualEntryForm />

          {sessions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
                <MapPin size={16} className="text-cyan-400" />
                <span>過去のウォーキング記録</span>
              </div>
              {sessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Footprints size={48} className="mx-auto mb-3 opacity-25" />
              <p className="text-sm">まだウォーキングの記録がありません</p>
              <p className="text-xs mt-1">スタートボタンで記録を始めましょう</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
