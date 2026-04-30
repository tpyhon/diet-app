import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default api

// ── 食事 ──────────────────────────────
export const fetchTodayMeals = () => api.get('/meals/today')
export const fetchMeals      = () => api.get('/meals/')
export const createMeal      = (data: MealCreate) => api.post('/meals/', data)
export const deleteMeal      = (id: number) => api.delete(`/meals/${id}`)

// ── ウォーキング ────────────────────────
export const fetchWalkingSessions = () => api.get('/walking/')
export const createWalkingSession = (data: unknown) => api.post('/walking/', data)
export const fetchRoute           = (id: number) => api.get(`/walking/${id}/route`)

// ── 筋トレ ─────────────────────────────
export const fetchPlans        = () => api.get('/training/plans')
export const createPlan        = (data: unknown) => api.post('/training/plans', data)
export const deletePlan        = (id: number) => api.delete(`/training/plans/${id}`)
export const fetchTodaySuggest = () => api.get('/training/today-suggestion')
export const createLog         = (data: unknown) => api.post('/training/logs', data)
export const fetchLogs         = () => api.get('/training/logs')
export const fetchGameStatus   = () => api.get('/training/game-status')

// ── 体重 ───────────────────────────────
export const fetchWeightHistory = (period: string) => api.get(`/weight/history?period=${period}`)
export const createWeight       = (data: unknown) => api.post('/weight/', data)
export const deleteWeight       = (id: number) => api.delete(`/weight/${id}`)

// ── AI ────────────────────────────────
export const fetchAiAdvice = () => api.get('/ai/advice')

// ── 型定義（type キーワードで明示）────────
export type MealCreate = {
  meal_type: string
  food_name: string
  quantity: string
  notes?: string
}

export type Meal = {
  id: number
  date: string
  meal_type: string
  food_name: string
  quantity: string
  estimated_calories: number
  notes?: string
}

export type WalkingSession = {
  id: number
  start_time: string
  end_time: string
  duration_minutes: number
  distance_km: number
  avg_speed_kmh: number
  estimated_calories: number
  notes?: string
}

export type TrainingPlan = {
  id: number
  name: string
  body_part: string
  exercises: Exercise[]
  day_of_week?: number
}

export type Exercise = {
  name: string
  sets: number
  reps: number
  weight_kg?: number
}

export type WeightRecord = {
  id: number
  date: string
  weight_kg: number
  body_fat_pct?: number
  notes?: string
}

export type GameStatus = {
  total_xp: number
  level: number
  streak_days: number
  next_level_xp: number
  badges: string[]
}

// ── AI プラン生成 ──────────────────────────────────────
export const generateAiPlan = (data: AiPlanRequest) =>
  api.post('/ai/generate-plan', data)

export type AiPlanRequest = {
  fitness_level: 'beginner' | 'intermediate' | 'advanced'
  goal: 'diet' | 'muscle' | 'health'
  available_days: number
  target_parts: string[]
  equipment: 'none' | 'dumbbell' | 'gym'
  minutes_per_session: number
  notes?: string
}
