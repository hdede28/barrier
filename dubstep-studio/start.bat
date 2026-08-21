@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PORT=8420

where python >nul 2>nul
if %errorlevel%==0 (
  set PYCMD=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PYCMD=py
  ) else (
    echo Python bulunamadi. Lutfen once Python yukleyin: https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

echo Dubstep Studio baslatiliyor: http://localhost:%PORT%
echo (Bu pencereyi kapatmak uygulamayi da durdurur.)

start /min cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%"
%PYCMD% -m http.server %PORT%
