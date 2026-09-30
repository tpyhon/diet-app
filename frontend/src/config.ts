/**
 * API Configuration
 * Automatically selects the correct API endpoint based on environment
 */

const API_BASE_URL = import.meta.env.MODE === 'production'
  ? import.meta.env.VITE_API_URL || 'https://diet-app-backend.onrender.com'
  : 'http://localhost:8081';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
};

export default API_CONFIG;
