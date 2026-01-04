#!/bin/bash

# Test script for Go implementation
# This script validates the Go server implementation

set -e

echo "========================================="
echo "ZikTok Go Implementation Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to print test results
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

info() {
    echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

echo "1. Testing Go compilation..."
if go build -o ziktok-test server.go 2>/dev/null; then
    pass "Go code compiles successfully"
else
    fail "Go code compilation failed"
    exit 1
fi

echo ""
echo "2. Checking binary size..."
BINARY_SIZE=$(stat -f%z ziktok-test 2>/dev/null || stat -c%s ziktok-test 2>/dev/null)
BINARY_SIZE_MB=$(echo "scale=2; $BINARY_SIZE / 1024 / 1024" | bc)
info "Binary size: ${BINARY_SIZE_MB} MB"

if (( $(echo "$BINARY_SIZE_MB < 10" | bc -l) )); then
    pass "Binary size is under 10 MB"
else
    fail "Binary size exceeds 10 MB"
fi

echo ""
echo "3. Testing optimized build..."
if go build -ldflags="-s -w" -o ziktok-optimized server.go 2>/dev/null; then
    OPTIMIZED_SIZE=$(stat -f%z ziktok-optimized 2>/dev/null || stat -c%s ziktok-optimized 2>/dev/null)
    OPTIMIZED_SIZE_MB=$(echo "scale=2; $OPTIMIZED_SIZE / 1024 / 1024" | bc)
    info "Optimized binary size: ${OPTIMIZED_SIZE_MB} MB"
    REDUCTION=$(echo "scale=1; ($BINARY_SIZE - $OPTIMIZED_SIZE) / $BINARY_SIZE * 100" | bc)
    info "Size reduction: ${REDUCTION}%"
    pass "Optimized build successful"
    rm -f ziktok-optimized
else
    fail "Optimized build failed"
fi

echo ""
echo "4. Testing static file directory..."
if [ -d "public" ]; then
    pass "public/ directory exists"
    FILE_COUNT=$(find public -type f | wc -l)
    info "Static files found: $FILE_COUNT"
else
    fail "public/ directory missing"
fi

echo ""
echo "5. Validating Go module..."
if [ -f "go.mod" ]; then
    pass "go.mod file exists"
    go mod verify 2>/dev/null && pass "Go module verified" || fail "Go module verification failed"
else
    fail "go.mod file missing"
fi

echo ""
echo "6. Testing Dockerfile.go..."
if [ -f "Dockerfile.go" ]; then
    pass "Dockerfile.go exists"

    # Check for multi-stage build
    if grep -q "FROM.*AS builder" Dockerfile.go && grep -q "FROM alpine" Dockerfile.go; then
        pass "Multi-stage build detected"
    else
        fail "Multi-stage build not properly configured"
    fi

    # Check for security features
    if grep -q "USER" Dockerfile.go; then
        pass "Non-root user configured"
    else
        fail "Running as root (security issue)"
    fi
else
    fail "Dockerfile.go missing"
fi

echo ""
echo "7. Testing docker-compose.go.yml..."
if [ -f "docker-compose.go.yml" ]; then
    pass "docker-compose.go.yml exists"
else
    fail "docker-compose.go.yml missing"
fi

echo ""
echo "8. Code quality checks..."

# Check for proper error handling
ERROR_HANDLING=$(grep -c "if err != nil" server.go)
info "Error handling checks: $ERROR_HANDLING"
if [ "$ERROR_HANDLING" -ge 5 ]; then
    pass "Adequate error handling"
else
    fail "Insufficient error handling"
fi

# Check for logging
if grep -q "log.Printf" server.go; then
    pass "Logging implemented"
else
    fail "No logging found"
fi

# Check for cache implementation
if grep -q "sync.RWMutex" server.go && grep -q "Cache" server.go; then
    pass "Thread-safe cache implemented"
else
    fail "Cache not properly implemented"
fi

echo ""
echo "9. API endpoint validation..."

# Check for required endpoints
if grep -q "/api/channel/{channelId}/shorts" server.go; then
    pass "Shorts endpoint defined"
else
    fail "Shorts endpoint missing"
fi

if grep -q "/api/channel/search/{query}" server.go; then
    pass "Search endpoint defined"
else
    fail "Search endpoint missing"
fi

# Check for static file serving
if grep -q "http.FileServer" server.go; then
    pass "Static file serving configured"
else
    fail "Static file serving missing"
fi

echo ""
echo "10. Duration parsing test..."
if grep -q "parseDuration" server.go && grep -q "regexp.MustCompile" server.go; then
    pass "Duration parsing function implemented"
else
    fail "Duration parsing missing or incomplete"
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

# Cleanup
rm -f ziktok-test

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Set YOUTUBE_API_KEY environment variable"
    echo "  2. Run: go run server.go"
    echo "  3. Test at http://localhost:3000"
    echo "  4. Or build Docker: docker-compose -f docker-compose.go.yml up -d"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo "Please review the failures above."
    exit 1
fi
