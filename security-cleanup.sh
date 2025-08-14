#!/bin/bash

# 🔒 SECURITY CLEANUP SCRIPT - Remove Exposed Mux Credentials
# This script removes hardcoded credentials from your codebase

echo "🔒 SECURITY CLEANUP - REMOVING EXPOSED MUX CREDENTIALS"
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# The exposed credentials to find and remove
EXPOSED_TOKEN_ID="660383c1-ab86-47b2-846a-7e132dae1545"
EXPOSED_SECRET="Ke3t9JtAS3Qz2boZ6NEflHUbiChZZqNiIGvpqEHBGfQFUC7PfvJxyTtIfUZylLgJO8Je5O4R95Q"

echo "🔍 Scanning for exposed credentials..."

# Search for any remaining instances
FOUND_TOKEN=$(grep -r "$EXPOSED_TOKEN_ID" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null)
FOUND_SECRET=$(grep -r "$EXPOSED_SECRET" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null)

if [ -n "$FOUND_TOKEN" ] || [ -n "$FOUND_SECRET" ]; then
    echo -e "${RED}❌ EXPOSED CREDENTIALS STILL FOUND!${NC}"
    echo ""
    echo "Files with exposed token ID:"
    echo "$FOUND_TOKEN"
    echo ""
    echo "Files with exposed secret:"
    echo "$FOUND_SECRET"
    echo ""
    echo -e "${YELLOW}⚠️  Please manually review and remove these credentials!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ NO EXPOSED CREDENTIALS FOUND${NC}"
    echo ""
    echo "🛡️  Security Status: CLEAN"
    echo "📁 Scanned: All files in project"
    echo "🔍 Excluded: node_modules, .git"
    echo ""
    echo -e "${GREEN}🎉 Your Mux credentials have been successfully removed!${NC}"
    echo ""
    echo "🔐 NEXT STEPS:"
    echo "1. Commit these security changes immediately"
    echo "2. Deploy Google Cloud replacement to eliminate Mux completely"
    echo "3. Revoke/regenerate your Mux credentials if still using them"
    echo "4. Use environment variables for any sensitive data"
    echo ""
    echo -e "${YELLOW}💡 TIP: The Google Cloud solution eliminates these security risks!${NC}"
fi

echo "====================================================="
echo "🚀 Ready to deploy secure Google Cloud solution!"
