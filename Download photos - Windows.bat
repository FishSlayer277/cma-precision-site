@echo off
title Downloading CMA Precision photos
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0download-photos.ps1"
echo.
pause
