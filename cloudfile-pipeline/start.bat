@echo off
setlocal

cd /d "%~dp0"

echo Installing root dependencies...
npm install
if errorlevel 1 exit /b 1

echo Installing backend dependencies...
cd backend
npm install
if errorlevel 1 exit /b 1

echo Installing frontend dependencies...
cd ..\frontend
npm install
if errorlevel 1 exit /b 1

echo Starting backend and frontend...
cd ..
npm run dev