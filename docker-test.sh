#!/bin/bash

# ZikTok Docker Deployment Test Script
# This script validates the Docker deployment

set -e  # Exit on any error

echo "🐳 ZikTok Docker Deployment Test"
echo "================================="
echo ""

# Check if Docker is installed
echo "1. Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "✅ Docker is installed: $(docker --version)"
echo ""

# Check if Docker Compose is installed
echo "2. Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
echo "✅ Docker Compose is installed: $(docker-compose --version)"
echo ""

# Check if .env file exists
echo "3. Checking for .env file..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "⚠️  Please edit .env and add your YOUTUBE_API_KEY"
        echo "   Then run this script again."
        exit 1
    else
        echo "❌ .env.example not found. Cannot proceed."
        exit 1
    fi
fi
echo "✅ .env file exists"
echo ""

# Check if API key is set
echo "4. Checking YOUTUBE_API_KEY..."
if grep -q "your_youtube_api_key_here" .env; then
    echo "⚠️  API key not configured in .env file"
    echo "   Please edit .env and add your actual YOUTUBE_API_KEY"
    echo "   Get one at: https://console.cloud.google.com/apis/credentials"
    exit 1
fi
echo "✅ YOUTUBE_API_KEY appears to be configured"
echo ""

# Build Docker image
echo "5. Building Docker image..."
docker build -t ziktok:test . > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Failed to build Docker image"
    exit 1
fi
echo ""

# Check image size
echo "6. Checking image size..."
IMAGE_SIZE=$(docker images ziktok:test --format "{{.Size}}")
echo "✅ Image size: $IMAGE_SIZE"
echo ""

# Test docker-compose configuration
echo "7. Validating docker-compose.yml..."
docker-compose config > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ docker-compose.yml is valid"
else
    echo "❌ docker-compose.yml has errors"
    exit 1
fi
echo ""

# Check if port 3000 is available
echo "8. Checking if port 3000 is available..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use"
    echo "   You may need to use a different port or stop the other service"
else
    echo "✅ Port 3000 is available"
fi
echo ""

echo "================================="
echo "✅ All checks passed!"
echo ""
echo "Ready to deploy! Run:"
echo "  docker-compose up -d"
echo ""
echo "Then access the app at:"
echo "  http://localhost:3000"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo "================================="
