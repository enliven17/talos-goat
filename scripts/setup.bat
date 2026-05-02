@echo off
REM Talos Protocol — Production Setup Script (Windows)
REM Run this to verify your deployment configuration

echo.
echo ================================
echo   Talos Protocol Setup Check
echo ================================
echo.

set PASS=0
set WARN=0
set FAIL=0

echo Checking Environment Variables...
echo --------------------------------

if "%DATABASE_URL%"=="" (
    echo [FAIL] DATABASE_URL not set
    set /a FAIL+=1
) else (
    echo [PASS] DATABASE_URL is set
    set /a PASS+=1
)

if "%DIRECT_URL%"=="" (
    echo [FAIL] DIRECT_URL not set
    set /a FAIL+=1
) else (
    echo [PASS] DIRECT_URL is set
    set /a PASS+=1
)

if "%GOAT_NETWORK%"=="" (
    echo [WARN] GOAT_NETWORK not set (defaulting to testnet)
    set /a WARN+=1
) else (
    echo [PASS] GOAT_NETWORK=%GOAT_NETWORK%
    set /a PASS+=1
)

if "%GOAT_OPERATOR_PRIVATE_KEY%"=="" (
    echo [FAIL] GOAT_OPERATOR_PRIVATE_KEY not set
    set /a FAIL+=1
) else (
    echo [PASS] GOAT_OPERATOR_PRIVATE_KEY is set
    set /a PASS+=1
)

if "%NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS%"=="" (
    echo [WARN] NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS not set (will use off-chain mode)
    set /a WARN+=1
) else (
    echo [PASS] NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS is set
    set /a PASS+=1
)

if "%OPENAI_API_KEY%"=="" (
    echo [FAIL] OPENAI_API_KEY not set
    set /a FAIL+=1
) else (
    echo [PASS] OPENAI_API_KEY is set
    set /a PASS+=1
)

echo.
echo Checking Tools...
echo --------------------------------

where node >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [PASS] Node.js found
    set /a PASS+=1
) else (
    echo [FAIL] Node.js not found
    set /a FAIL+=1
)

where pnpm >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [PASS] pnpm found
    set /a PASS+=1
) else (
    echo [FAIL] pnpm not found
    set /a FAIL+=1
)

echo.
echo ================================
echo   Results
echo ================================
echo   Passed: %PASS%
echo   Warnings: %WARN%
echo   Failed: %FAIL%
echo.

if %FAIL%==0 (
    echo Setup looks good!
    echo.
    echo Next steps:
    echo   1. cd contracts ^&^& pnpm build ^&^& pnpm deploy:testnet
    echo   2. Copy the printed 0x addresses into web/.env.local + Vercel
    echo   3. cd web ^&^& vercel --prod
    echo   4. Deploy agents via ClawUp (see packages/prime-agent/DEPLOY.md)
    echo   5. Visit your deployed app!
) else (
    echo Please fix the issues above before deploying
    exit /b 1
)
