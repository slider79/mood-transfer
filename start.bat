@echo off
setlocal
title Mood Transfer Launcher
cd /d "%~dp0"

echo ===================================================
echo               Mood Transfer Launcher
echo ===================================================
echo.

:: 1. Detect Python
set "PY_CMD="
if exist "%~dp0backend\.venv\Scripts\python.exe" (
    set PY_CMD="%~dp0backend\.venv\Scripts\python.exe"
) else (
    py -3 -c "import sys" >nul 2>&1
    if not errorlevel 1 (
        set PY_CMD=py -3
    ) else (
        python -c "import sys" >nul 2>&1
        if not errorlevel 1 (
            set PY_CMD=python
        )
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python 3 was not found on your system.
    echo Please install Python 3.12 or newer, or set up a virtual environment in backend\.venv
    echo.
    pause
    exit /b 1
)

:: 2. Check Node / npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm was not found on your system.
    echo Please install Node.js 20 or newer from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 3. Check frontend dependencies
if not exist "%~dp0frontend\node_modules\" (
    echo [INFO] Installing frontend dependencies with npm install...
    cd /d "%~dp0frontend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

:: 4. Check backend dependencies
%PY_CMD% -c "import fastapi, uvicorn, torch, PIL" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing backend dependencies...
    %PY_CMD% -m pip install -r "%~dp0backend\requirements.txt" --extra-index-url https://download.pytorch.org/whl/cpu
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
)

:: 5. Launch Backend
echo [INFO] Starting Backend on http://127.0.0.1:8000 ...
start "Mood Transfer - Backend" cmd /k "cd /d "%~dp0backend" && %PY_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: 6. Launch Frontend
echo [INFO] Starting Frontend on http://localhost:5173 ...
start "Mood Transfer - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: 7. Wait for servers to initialize, then open browser
echo [INFO] Waiting for servers to initialize...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173

echo.
echo ===================================================
echo           Mood Transfer is running!
echo ===================================================
echo  Frontend UI : http://localhost:5173
echo  Backend API : http://127.0.0.1:8000
echo.
echo  Press any key in this window to stop both servers...
echo ===================================================
echo.
pause >nul

echo [INFO] Stopping Mood Transfer servers...
taskkill /FI "WINDOWTITLE eq Mood Transfer - Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Mood Transfer - Frontend*" /T /F >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo [INFO] Servers stopped.
ping 127.0.0.1 -n 2 >nul
exit /b 0
