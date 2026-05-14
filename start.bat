@echo off
echo ===================================================
echo  My Diet App Startup Script
echo ===================================================

cd /d "%~dp0"

echo Starting Backend Server...
start "Diet App Backend" cmd /k "call venv\Scripts\activate && cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo Starting Frontend Server...
start "Diet App Frontend" cmd /k "cd frontend && npm run dev"

echo Startup completed!
