@echo off
title Math & Mechanics Club - Public Leadership Form
cd /d "%~dp0"
echo ==================================================================
echo   Starting Math & Mechanics Club Server + Public Internet Tunnel
echo ==================================================================
echo.
echo 1. Starting Node.js server...
start "Math Club Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul
echo.
echo 2. Opening Secure Public Tunnel...
echo Sharing over internet via localhost.run...
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
pause
