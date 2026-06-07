@echo off
setlocal

:: ── whtui launcher ────────────────────────────────────────────────────────────
:: Resolves its own location so it works from any working directory.
:: Add  d:\PROJECTS\whtui  to your User PATH to run it like:  whtui
:: ──────────────────────────────────────────────────────────────────────────────

set "WHTUI_DIR=%~dp0"
:: Remove trailing backslash that %~dp0 always appends
if "%WHTUI_DIR:~-1%"=="\" set "WHTUI_DIR=%WHTUI_DIR:~0,-1%"

cd /d "%WHTUI_DIR%"

:: Install / update dependencies (fast no-op when already satisfied)
call npm install --prefer-offline --silent

:: Launch
call npm start

endlocal
