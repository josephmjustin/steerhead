# Steerhead - run both backend and frontend

Write-Host "Starting Steerhead..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; pip install -r requirements.txt -q; uvicorn app.main:app --reload --port 8000"

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install -s; npm run dev"

Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "Open http://localhost:5173 in your browser" -ForegroundColor Yellow
