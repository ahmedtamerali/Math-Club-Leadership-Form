@echo off
title Math & Mechanics Club - Leadership Form Server
cd /d "%~dp0"
echo ===================================================
echo   Math & Mechanics Club Leadership Form Server
echo ===================================================
echo.
echo Starting Express Server on Port 3000...
echo Form Link (Students):       http://localhost:3000/apply
echo Review Portal (Leaders):    http://localhost:3000/leaders?key=math2026
echo Passcode:                   math2026
echo.
echo Press Ctrl+C anytime to stop the server.
echo.
node server.js
pause
