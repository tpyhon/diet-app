// frontend/src/api.ts

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ───── 共通フェッチ ─────

async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json() as Promise<T>;
}

// ───── 型定義 ─────

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Meal {
  id: number;
  description: string;
  calories: number;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  meal_type: string | null;
  recorded_at: string;
}

export interface TodayMeals {
  meals: Meal[];
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  calorie_goal: number;
}

export interface WalkingSession {
  id: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  avg_speed_kmh: number | null;
  estimated_calories: number | null;
  route_data: string | null;
}

export interface TrainingPlan {
  id: number;
  name: string;
  target_muscle: string;
  day_of_week: number | null;
  exercises: string;
  fitness_level: string | null;
  goal: string | null;
}

export interface TrainingLog {
  id: number;
  plan_id: number;
  logged_at: string;
  duration_minutes: number | null;
  notes: string | null;
}

export interface GameStatus {
  total_xp: number;
  next_level_xp: number;
  level: number;
  streak_days: number;
  badges: string[];
}

export interface WeightRecord {
  id: number;
  weight_kg: number;
  body_fat_percent: number | null;
  recorded_at: string;
}

export interface WeightGoal {
  target_weight_kg: number;
  predicted_date: string | null;
  current_weight_kg: number | null;
}

export interface UserProfile {
  id: number;
  username: string;
  age: number | null;
  gender: "male" | "female" | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  goal: "lose" | "maintain" | "gain" | null;
  calorie_goal: number;
}

export interface ProfileUpdateRequest {
  age?: number;
  gender?: "male" | "female";
  height_cm?: number;
  current_weight_kg?: number;
  activity_level?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal?: "lose" | "maintain" | "gain";
  calorie_goal?: number;
}

// ───── 認証 ─────

export const login = (username: string, password: string) =>
  apiFetch<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const register = (username: string, password: string) =>
  apiFetch<{ access_token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = (): Promise<UserProfile> =>
  apiFetch("/api/auth/me");

export const updateProfile = (data: ProfileUpdateRequest): Promise<UserProfile> =>
  apiFetch("/api/auth/profile", { method: "PUT", body: JSON.stringify(data) });

// ───── 食事 ─────

export const getMeals = (): Promise<Meal[]> =>
  apiFetch("/api/meals/");

export const getTodayMeals = (): Promise<TodayMeals> =>
  apiFetch("/api/meals/today");

export const createMealFromText = (description: string, meal_type?: string): Promise<Meal> =>
  apiFetch("/api/meals/", {
    method: "POST",
    body: JSON.stringify({ description, meal_type }),
  });

export const createMealWithCalories = (data: {
  description: string;
  calories: number;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  meal_type?: string;
}): Promise<Meal> =>
  apiFetch("/api/meals/with-calories", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const analyzeMealImage = async (file: File) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/meals/analyze-image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteMeal = (id: number): Promise<{ ok: boolean }> =>
  apiFetch(`/api/meals/${id}`, { method: "DELETE" });

// ───── ウォーキング ─────

export const getWalkingSessions = (): Promise<WalkingSession[]> =>
  apiFetch("/api/walking/");

export const createWalkingSession = (data: Partial<WalkingSession>): Promise<WalkingSession> =>
  apiFetch("/api/walking/", { method: "POST", body: JSON.stringify(data) });

export const getWalkingRoute = (id: number) =>
  apiFetch<{ route_data: string }>(`/api/walking/${id}/route`);

export const deleteWalking = (id: number): Promise<{ ok: boolean }> =>
  apiFetch(`/api/walking/${id}`, { method: "DELETE" });

// ───── 筋トレ ─────

export const getTrainingPlans = (): Promise<TrainingPlan[]> =>
  apiFetch("/api/training/plans");

export const createTrainingPlan = (data: Partial<TrainingPlan>): Promise<TrainingPlan> =>
  apiFetch("/api/training/plans", { method: "POST", body: JSON.stringify(data) });

export const deleteTrainingPlan = (id: number): Promise<{ ok: boolean }> =>
  apiFetch(`/api/training/plans/${id}`, { method: "DELETE" });

export const getTrainingLogs = (): Promise<TrainingLog[]> =>
  apiFetch("/api/training/logs");

export const createTrainingLog = (data: Partial<TrainingLog>): Promise<TrainingLog> =>
  apiFetch("/api/training/logs", { method: "POST", body: JSON.stringify(data) });

export const deleteTrainingLog = (id: number): Promise<{ ok: boolean }> =>
  apiFetch(`/api/training/logs/${id}`, { method: "DELETE" });

export const getGameStatus = (): Promise<GameStatus> =>
  apiFetch("/api/training/game-status");

export const getTodaySuggestion = (): Promise<TrainingPlan | null> =>
  apiFetch("/api/training/today-suggestion");

export const generateTrainingPlan = (params: {
  fitness_level: string;
  goal: string;
  equipment: string;
  duration_minutes: number;
}) =>
  apiFetch<{ plans: TrainingPlan[] }>("/api/ai/generate-plan", {
    method: "POST",
    body: JSON.stringify(params),
  });

// ───── 体重 ─────

export const getWeightHistory = (period?: string): Promise<WeightRecord[]> =>
  apiFetch(`/api/weight/history${period ? `?period=${period}` : ""}`);

export const createWeightRecord = (data: {
  weight_kg: number;
  body_fat_percent?: number;
}): Promise<WeightRecord> =>
  apiFetch("/api/weight/", { method: "POST", body: JSON.stringify(data) });

export const deleteWeightRecord = (id: number): Promise<{ ok: boolean }> =>
  apiFetch(`/api/weight/${id}`, { method: "DELETE" });

export const getWeightGoal = (): Promise<WeightGoal> =>
  apiFetch("/api/weight/goal");

export const setWeightGoal = (target_weight_kg: number): Promise<WeightGoal> =>
  apiFetch("/api/weight/goal", {
    method: "POST",
    body: JSON.stringify({ target_weight_kg }),
  });

export const getWeightPredictionData = () =>
  apiFetch<{ actual: WeightRecord[]; prediction: { date: string; weight_kg: number }[] }>(
    "/api/weight/prediction-data"
  );

// ───── AI ─────

export const getAiAdvice = (): Promise<{ advice: string }> =>
  apiFetch("/api/ai/advice");
