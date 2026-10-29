@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Abis: Sonsuz Gece

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js kurulu degil. Oyun bunu gerektirir.
  echo Tarayicida nodejs.org aciliyor. LTS surumunu kurup bu dosyayi yeniden acin.
  start "" "https://nodejs.org/tr/download"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Ilk acilis. Paketler indiriliyor, bu birkac dakika surebilir...
  call npm install
  if errorlevel 1 (
    echo Kurulum basarisiz. Internet baglantinizi kontrol edip yeniden deneyin.
    pause
    exit /b 1
  )
)

echo Abis: Sonsuz Gece basliyor. Tarayici birazdan acilacak.
echo Kapatmak icin bu pencereyi kapatin.
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://127.0.0.1:8080"
call npm run dev
pause
