#!/bin/bash

# ZikTok - Easy Update Script for Synology NAS
# This script pulls the latest code and rebuilds the container properly

set -e  # Exit on error

echo "🔄 ZikTok Update Script for Synology"
echo "===================================="
echo ""

# Check if running in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found"
    echo "   Please run this script from the /volume1/docker/ziktok directory"
    exit 1
fi

echo "1. Pulling latest code from git..."
git pull || {
    echo "⚠️  Git pull failed. Continuing anyway..."
}

echo ""
echo "2. Stopping and removing old container..."
sudo docker-compose down

echo ""
echo "3. Removing old image to force rebuild..."
sudo docker rmi ziktok-ziktok 2>/dev/null || echo "   (No old image to remove)"

echo ""
echo "4. Building new image and starting container..."
sudo docker-compose up -d --build

echo ""
echo "5. Waiting for container to start..."
sleep 3

echo ""
echo "6. Checking container status..."
sudo docker-compose ps

echo ""
echo "✅ Update complete!"
echo ""
echo "View logs with: sudo docker-compose logs -f"
echo "Check status:   sudo docker-compose ps"
echo "Access app at:  http://your-nas-ip:3000"
echo ""
