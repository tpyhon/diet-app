// frontend/src/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── JWTトークンを自動付与するインターセプター ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── 401エラー時に自動ログアウト ──
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── 認証 ──────────────────────────────────────
export const loginApi = (username: string, password: string) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return axios.post('/api/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}
export const registerApi = (username: string, password: string, display_name?: string) =>
  api.post('/auth/register', { username, password, display_name })

// ── プロフィール ────────────────────────────────
export const fetchProfile          = () => api.get('/auth/me')
export const updateProfile         = (data: ProfileUpdate) => api.put('/auth/profile', data)
export const suggestCalorieGoal    = () => api.post('/auth/suggest-calorie-goal')

// ── 食事 ──────────────────────────────────────
export const fetchTodayMeals       = () => api.get('/meals/today')
export const fetchMeals            = () => api.get('/meals/')
export const createMeal            = (data: MealCreate) => api.post('/meals/', data)
export const deleteMeal            = (id: number) => api.delete(`/meals/${id}`)
export const createMealWithCalories = (data: MealCreateWithCalories) =>
  api.post('/meals/with-calories', data)
export const analyzeFoodImage = (file: File, mealType: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('meal_type', mealType)
  return api.post('/meals/analyze-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const lookupBarcode = (barcode: string) =>
  api.get(`/meals/barcode/${barcode}`)

// ── ウォーキング ────────────────────────────────
export const fetchWalkingSessions  = () => api.get('/walking/')
export const createWalkingSession  = (data: unknown) => api.post('/walking/', data)
export const fetchRoute            = (id: number) => api.get(`/walking/${id}/route`)
export const deleteWalkingSession  = (id: number) => api.delete(`/walking/${id}`)

// ── 筋トレ ──────────────────────────────────────
export const fetchPlans            = () => api.get('/training/plans')
export const createPlan            = (data: unknown) => api.post('/training/plans', data)
export const deletePlan            = (id: number) => api.delete(`/training/plans/${id}`)
export const fetchTodaySuggest     = () => api.get('/training/today-suggestion')
export const createLog             = (data: unknown) => api.post('/training/logs', data)
export const fetchLogs             = () => api.get('/training/logs')
export const fetchGameStatus       = () => api.get('/training/game-status')
export const deleteTrainingLog     = (id: number) => api.delete(`/training/logs/${id}`)

// ── 体重 ────────────────────────────────────────
export const fetchWeightHistory    = (period: string) => api.get(`/weight/history?period=${period}`)
export const createWeight          = (data: unknown) => api.post('/weight/', data)
export const deleteWeight          = (id: number) => api.delete(`/weight/${id}`)
export const fetchWeightGoal       = () => api.get('/weight/goal')
export const setWeightGoal         = (data: WeightGoalCreate) => api.post('/weight/goal', data)
export const fetchPredictionData   = () => api.get('/weight/prediction-data')

// ── AI ─────────────────────────────────────────
export const fetchAiAdvice         = () => api.get('/ai/advice')
export const generateAiPlan        = (data: AiPlanRequest) => api.post('/ai/generate-plan', data)


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 型定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type MealCreate = {
  meal_type: string
  food_name: string
  quantity: string
  notes?: string
}

export type MealCreateWithCalories = {
  meal_type: string
  food_name: string
  quantity: string
  estimated_calories: number
  protein_g?: number
  fat_g?: number
  carbs_g?: number
  notes?: string
}

export type Meal = {
  id: number
  date: string
  meal_type: string
  food_name: string
  quantity: string
  estimated_calories: number
  protein_g?: number
  fat_g?: number
  carbs_g?: number
  notes?: string
}

export type TodayMealsResponse = {
  meals: Meal[]
  total_calories: number
  total_protein: number
  total_fat: number
  total_carbs: number
}

export type ImageAnalysisResult = {
  meal_type: string
  food_name: string
  quantity: string
  estimated_calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  description: string
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
  manual_distance_km?: number
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

export type AiPlanRequest = {
  fitness_level: 'beginner' | 'intermediate' | 'advanced'
  goal: 'diet' | 'muscle' | 'health'
  available_days: number
  target_parts: string[]
  equipment: 'none' | 'dumbbell' | 'gym'
  minutes_per_session: number
  notes?: string
}

export type WeightGoalCreate = {
  target_weight_kg: number
  target_date?: string
}

export type WeightGoal = {
  id: number
  target_weight_kg: number
  target_date?: string
}

// ── 推奨PFC型（UserProfileより前に定義する） ──────────────────
export type RecommendedPfc = {
  protein_g: number
  fat_g: number
  carbs_g: number
  ratio: {
    protein_pct: number
    fat_pct: number
    carbs_pct: number
  }
}

export type UserProfile = {
  id: number
  username: string
  display_name: string
  age?: number
  gender?: 'male' | 'female' | 'other'
  height_cm?: number
  weight_kg?: number
  activity_level?: 'sedentary' | 'lightly' | 'moderately' | 'very' | 'super'
  diet_goal?: 'lose' | 'maintain' | 'gain'
  calorie_goal: number
  recommended_pfc?: RecommendedPfc  // ← これが抜けていた
}


export type ProfileUpdate = {
  display_name?: string
  age?: number
  gender?: 'male' | 'female' | 'other'
  height_cm?: number
  weight_kg?: number
  activity_level?: 'sedentary' | 'lightly' | 'moderately' | 'very' | 'super'
  diet_goal?: 'lose' | 'maintain' | 'gain'
  calorie_goal?: number
}
