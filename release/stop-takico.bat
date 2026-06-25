@echo off
setlocal
set "PORT=8765"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
taskkill /F /IM takico-server.exe >nul 2>&1
echo Takico stopped.
timeout /t 2 /nobreak >nul
endlocal
exit /b 0
