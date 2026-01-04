# Quick Update Guide for Synology NAS

This guide explains the new fast update system that eliminates the need for rebuilding Docker images.

## 🚀 What Changed?

Previously, updating ZikTok required:
- Rebuilding the Docker image (~2-3 minutes)
- Running the `update-synology.sh` script

Now, with volume mounts, you can update instantly:
- **No rebuild needed** - code changes are immediately available
- **~10 seconds** instead of 2-3 minutes
- Two convenient update methods

---

## 📋 One-Time Setup

### 1. Update Your Environment File

Add the `UPDATE_TOKEN` to your `.env` file:

```bash
# SSH to your Synology NAS
ssh admin@your-nas-ip

# Navigate to ZikTok directory
cd /volume1/docker/ziktok

# Generate a secure token
openssl rand -hex 32

# Add it to your .env file
echo "UPDATE_TOKEN=<paste-the-generated-token-here>" >> .env
```

### 2. Recreate the Container (One Time Only)

This is required to enable volume mounts:

```bash
# Stop and remove the old container
docker-compose down

# Remove the old image (forces rebuild with new volume config)
docker rmi ziktok-ziktok

# Recreate with volume mounts
docker-compose up -d --build
```

**That's it!** You only need to do this once.

---

## 🔄 How to Update (Choose One Method)

### Method 1: HTTP Endpoint (Easiest) ⭐

Update from anywhere by visiting a URL in your browser:

```
http://your-nas-ip:3000/update?token=YOUR_UPDATE_TOKEN
```

**Example:**
```
http://192.168.1.100:3000/update?token=abc123def456...
```

**Or use curl:**
```bash
curl "http://your-nas-ip:3000/update?token=YOUR_UPDATE_TOKEN"
```

**Response when successful:**
```json
{
  "success": true,
  "message": "Code updated successfully. Server restarting...",
  "output": "Updating 1a2b3c4..5d6e7f8\nFast-forward\n server.js | 10 +++++-----\n 1 file changed, 5 insertions(+), 5 deletions(-)"
}
```

**Response when already up to date:**
```json
{
  "success": true,
  "message": "Already up to date",
  "output": "Already up to date."
}
```

---

### Method 2: Manual SSH (For Advanced Users)

SSH to your NAS and run:

```bash
cd /volume1/docker/ziktok
git pull
docker-compose restart
```

**That's it!** The container restarts with the new code in ~5 seconds.

---

## 📊 Comparison: Old vs New

| Aspect | Old Method (Rebuild) | New Method (Volume Mount) |
|--------|---------------------|---------------------------|
| **Time** | 2-3 minutes | ~10 seconds |
| **Requires SSH** | Yes | No (Method 1) |
| **Docker rebuild** | Yes | No |
| **Image size change** | Yes | No |
| **Complexity** | Medium | Very Simple |
| **Update from browser** | No | Yes (Method 1) |

---

## 🛠️ When Do You Still Need to Rebuild?

You **only** need to rebuild the Docker image if:

1. **Dependencies change** - you modify `package.json`
2. **Dockerfile changes** - you update the Dockerfile itself
3. **Node.js version upgrade** - you change the base image

For these cases, run the old update script:
```bash
cd /volume1/docker/ziktok
./update-synology.sh
```

---

## 🔒 Security Notes

- **Keep your UPDATE_TOKEN secret** - treat it like a password
- The token is **required** for the `/update` endpoint to work
- Without the token, the endpoint returns `401 Unauthorized`
- Consider using a firewall rule to restrict access to port 3000 if exposed to the internet

---

## 🐛 Troubleshooting

### The `/update` endpoint returns "Update endpoint not configured"

**Solution:** Make sure `UPDATE_TOKEN` is set in your `.env` file and you've restarted the container:
```bash
docker-compose restart
```

### Git pull fails with "fatal: not a git repository"

**Solution:** The container needs git. For now, use Method 2 (manual SSH). The Dockerfile will be updated in a future version to include git.

**Workaround:** Clone the repo on the NAS and use volume mounts to the NAS directory:
```bash
# On your NAS
cd /volume1/docker/ziktok
git pull  # This runs on the NAS, not in container
docker-compose restart
```

### Changes aren't showing up

**Solution:**
1. Make sure you did the one-time setup (recreated the container with volumes)
2. Check that volumes are mounted: `docker inspect ziktok | grep Mounts -A 20`
3. Restart the container: `docker-compose restart`

### How do I verify volumes are working?

```bash
# Check mounted volumes
docker inspect ziktok | grep -A 10 "Mounts"

# You should see entries like:
# "Source": "/volume1/docker/ziktok/server.js"
# "Destination": "/app/server.js"
```

---

## 📱 Bonus: Create a Bookmark

For ultra-quick updates, create a browser bookmark:

1. Open your browser
2. Create a new bookmark with this URL:
   ```
   http://your-nas-ip:3000/update?token=YOUR_UPDATE_TOKEN
   ```
3. Name it "Update ZikTok"
4. Click it whenever you want to update!

---

## 🎯 Summary

**For most updates:**
- Just click: `http://your-nas:3000/update?token=YOUR_TOKEN`
- Or SSH and run: `git pull && docker-compose restart`

**For dependency updates:**
- Run: `./update-synology.sh` (old method)

**That's it!** Enjoy your 10-second updates! 🚀
