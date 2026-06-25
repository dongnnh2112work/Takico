@echo off
setlocal
cd /d "%~dp0"
set "GAME=%~dp0_game"
set "PORT=8765"
set "TAKICO_PORT=%PORT%"
set "URL=http://127.0.0.1:%PORT%/"

if not exist "%GAME%\bin\takico-server.exe" (
  echo [ERROR] Missing _game folder. Copy the full windows package.
  pause
  exit /b 1
)

attrib +H "%GAME%" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

start "Takico Server" /min /D "%GAME%" "%GAME%\bin\takico-server.exe"
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

endlocal
exit /b 0
