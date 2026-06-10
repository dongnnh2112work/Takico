@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8765
set TAKICO_PORT=%PORT%
set URL=http://127.0.0.1:%PORT%/

if not exist "bin\takico-server.exe" (
  echo [LOI] Thieu file bin\takico-server.exe — giai nen lai zip day du.
  pause
  exit /b 1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

start "Takico Server" /min "bin\takico-server.exe"
timeout /t 2 /nobreak >nul

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%URL% --start-fullscreen --autoplay-policy=no-user-gesture-required
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%URL% --start-fullscreen --autoplay-policy=no-user-gesture-required
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%URL% --start-fullscreen
) else (
  start "" %URL%
)

echo.
echo  ============================================
echo   DI CUNG TAKICO - dang chay
echo   %URL%
echo.
echo   - Cho phep Camera khi trinh duyet hoi
echo   - Dong cua so "Takico Server" de tat game
echo  ============================================
echo.
pause
