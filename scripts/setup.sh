#!/bin/bash
# Talos Protocol — Production Setup Script
# Run this to verify your deployment configuration

set -e

echo "🚀 Talos Protocol — Setup Verification"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local required=${2:-true}
    
    if [ -z "$var_value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Missing: $var_name${NC}"
            FAIL=$((FAIL + 1))
        else
            echo -e "${YELLOW}⚠️  Optional: $var_name${NC}"
            WARN=$((WARN + 1))
        fi
    else
        echo -e "${GREEN}✅ Set: $var_name${NC}"
        PASS=$((PASS + 1))
    fi
}

echo "📋 Checking Environment Variables..."
echo "------------------------------------"
check_var "DATABASE_URL"
check_var "DIRECT_URL"
check_var "GOAT_NETWORK"
check_var "GOAT_RPC_URL"
check_var "GOAT_USDC_ADDRESS"
check_var "GOAT_OPERATOR_PRIVATE_KEY"
check_var "NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS"
check_var "NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS"
check_var "NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS"
check_var "NEXT_PUBLIC_GOAT_CHAIN_ID"
check_var "X402_FACILITATOR_URL"
check_var "X402_API_KEY"
check_var "OPENAI_API_KEY"
check_var "TAVILY_API_KEY"
check_var "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" "false"

echo ""
echo "📋 Checking Tools..."
echo "------------------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ Node.js not found${NC}"
    FAIL=$((FAIL + 1))
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    echo -e "${GREEN}✅ pnpm: $(pnpm --version)${NC}"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ pnpm not found${NC}"
    FAIL=$((FAIL + 1))
fi

# Check Hardhat (for contracts)
if [ -f contracts/hardhat.config.ts ]; then
    echo -e "${GREEN}✅ Hardhat project present (contracts/)${NC}"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️  contracts/hardhat.config.ts not found${NC}"
    WARN=$((WARN + 1))
fi

echo ""
echo "📋 Checking Database..."
echo "------------------------------------"

# Try to connect to database
if [ -n "$DATABASE_URL" ]; then
    cd web
    if pnpm db:push &> /dev/null; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        FAIL=$((FAIL + 1))
    fi
    cd ..
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping check${NC}"
    WARN=$((WARN + 1))
fi

echo ""
echo "========================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 Setup looks good!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy contracts: cd contracts && pnpm build && pnpm deploy:testnet"
    echo "  2. Copy the printed 0x addresses into web/.env.local + Vercel env vars"
    echo "  3. Deploy web: cd web && vercel --prod"
    echo "  4. Deploy agents via ClawUp (see packages/prime-agent/DEPLOY.md)"
    echo "  5. Visit your deployed app!"
else
    echo -e "${RED}⚠️  Please fix the issues above before deploying${NC}"
    exit 1
fi
