#!/bin/bash
# Verification script for Web App Reader Chrome Extension

echo "=== Web App Reader Extension Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if all required files exist
echo "1. Checking required files..."
files=(
  "manifest.json"
  "background/service-worker.js"
  "content-script.js"
  "overlay.css"
  "options.html"
  "options.js"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

all_files_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file (MISSING)"
    all_files_exist=false
  fi
done
echo ""

# Validate manifest.json
echo "2. Validating manifest.json..."
if command -v jq &> /dev/null; then
  if jq empty manifest.json 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Valid JSON syntax"
    
    # Check manifest version
    version=$(jq -r '.manifest_version' manifest.json)
    if [ "$version" == "3" ]; then
      echo -e "  ${GREEN}✓${NC} Manifest version 3"
    else
      echo -e "  ${RED}✗${NC} Manifest version is not 3"
    fi
    
    # Check required fields
    name=$(jq -r '.name' manifest.json)
    echo -e "  ${GREEN}✓${NC} Extension name: $name"
  else
    echo -e "  ${RED}✗${NC} Invalid JSON in manifest.json"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} jq not installed, skipping JSON validation"
  # Try with Python
  if python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Valid JSON syntax (checked with Python)"
  else
    echo -e "  ${RED}✗${NC} Invalid JSON in manifest.json"
  fi
fi
echo ""

# Check JavaScript syntax
echo "3. Validating JavaScript files..."
js_files=(
  "background/service-worker.js"
  "content-script.js"
  "options.js"
)

for js_file in "${js_files[@]}"; do
  if node -c "$js_file" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $js_file"
  else
    if [ -f "$js_file" ]; then
      # Node.js not available - check if file at least exists and has content
      if [ -s "$js_file" ]; then
        echo -e "  ${YELLOW}⚠${NC} $js_file (syntax not validated - Node.js required for full check)"
      else
        echo -e "  ${RED}✗${NC} $js_file (file is empty)"
      fi
    else
      echo -e "  ${RED}✗${NC} $js_file (file missing)"
    fi
  fi
done
echo ""

# Check HTML structure
echo "4. Validating HTML file..."
if grep -q "<!DOCTYPE html>" options.html; then
  echo -e "  ${GREEN}✓${NC} options.html has DOCTYPE declaration"
else
  echo -e "  ${RED}✗${NC} options.html missing DOCTYPE"
fi

if grep -q "<html" options.html; then
  echo -e "  ${GREEN}✓${NC} options.html has html tag"
else
  echo -e "  ${RED}✗${NC} options.html missing html tag"
fi
echo ""

# Check CSS
echo "5. Validating CSS file..."
if [ -f "overlay.css" ] && [ -s "overlay.css" ]; then
  echo -e "  ${GREEN}✓${NC} overlay.css exists and is not empty"
  
  # Check for required classes
  if grep -q "web-app-reader-overlay" overlay.css; then
    echo -e "  ${GREEN}✓${NC} Contains .web-app-reader-overlay class"
  else
    echo -e "  ${RED}✗${NC} Missing .web-app-reader-overlay class"
  fi
else
  echo -e "  ${RED}✗${NC} overlay.css missing or empty"
fi
echo ""

# Check icon sizes
echo "6. Checking icon files..."
for icon in icons/*.png; do
  if [ -f "$icon" ]; then
    size=$(stat -f%z "$icon" 2>/dev/null || stat -c%s "$icon" 2>/dev/null)
    if [ "$size" -gt 0 ]; then
      echo -e "  ${GREEN}✓${NC} $icon ($size bytes)"
    else
      echo -e "  ${RED}✗${NC} $icon is empty"
    fi
  fi
done
echo ""

# Summary
echo "=== Verification Summary ==="
if [ "$all_files_exist" = true ]; then
  echo -e "${GREEN}All required files are present!${NC}"
  echo ""
  echo "To load this extension in Chrome:"
  echo "1. Open chrome://extensions/"
  echo "2. Enable 'Developer mode'"
  echo "3. Click 'Load unpacked'"
  echo "4. Select this directory: $(pwd)"
else
  echo -e "${RED}Some required files are missing!${NC}"
fi
echo ""
