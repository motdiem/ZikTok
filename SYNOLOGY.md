# ZikTok on Synology NAS - Container Manager Deployment Guide

Complete guide for deploying ZikTok on your Synology NAS using Container Manager.

## Prerequisites

- Synology NAS with DSM 7.0 or higher
- Container Manager installed (from Package Center)
- YouTube API key ([Get one here](https://console.cloud.google.com/apis/credentials))
- SSH access enabled (optional, for command line method)

---

## Method 1: Container Manager GUI (Recommended)

### Step 1: Prepare Files on NAS

1. **Enable File Station**
   - Open File Station
   - Navigate to `/docker` folder (or create it if it doesn't exist)
   - Create a new folder: `ziktok`

2. **Upload Project Files**
   - Upload all files to `/docker/ziktok/`:
     - `Dockerfile`
     - `docker-compose.yml`
     - `package.json`
     - `server.js`
     - `public/` folder (with all contents)

3. **Create .env File**
   - In File Station, right-click in `/docker/ziktok/`
   - Create → Text File
   - Name it `.env`
   - Edit and add:
     ```
     YOUTUBE_API_KEY=your_youtube_api_key_here
     PORT=3000
     ```
   - Save and close

### Step 2: Build Using Container Manager

1. **Open Container Manager**
   - Go to DSM → Container Manager

2. **Create Project**
   - Go to "Project" tab
   - Click "Create"
   - Project Name: `ziktok`
   - Path: `/docker/ziktok`
   - Source: Select "Use existing docker-compose.yml"
   - Click "Next"

3. **Configure Settings**
   - Container Manager will read your docker-compose.yml
   - Review the configuration
   - Click "Done"

4. **Start the Project**
   - The project will appear in the Projects list
   - Click the toggle to start it
   - Wait for status to show "Running"

### Step 3: Access the Application

- Open browser: `http://nas-ip:3000`
- Or use your NAS hostname: `http://nas-hostname:3000`

---

## Method 2: SSH Command Line (Advanced)

### Step 1: Connect via SSH

```bash
ssh admin@your-nas-ip
```

### Step 2: Navigate to Docker Directory

```bash
cd /volume1/docker
mkdir ziktok
cd ziktok
```

### Step 3: Upload Files

Use SCP or Git:

```bash
# Option A: Clone from Git (if you have the repo)
git clone <your-repo-url> .

# Option B: SCP from your computer
# On your local machine:
scp -r * admin@your-nas-ip:/volume1/docker/ziktok/
```

### Step 4: Create .env File

```bash
cat > .env << EOF
YOUTUBE_API_KEY=your_youtube_api_key_here
PORT=3000
EOF
```

### Step 5: Deploy with Docker Compose

```bash
# Navigate to directory
cd /volume1/docker/ziktok

# Start the application
sudo docker-compose up -d

# View logs
sudo docker-compose logs -f

# Check status
sudo docker ps
```

---

## Method 3: Import Pre-built Image (Future)

If you publish to Docker Hub:

1. **Pull Image**
   - Container Manager → Image
   - Add → From Docker Hub
   - Search: `your-username/ziktok`
   - Download

2. **Create Container**
   - Double-click the image
   - Container Name: `ziktok`
   - Environment variables:
     - `YOUTUBE_API_KEY` = your key
     - `PORT` = 3000
   - Port Settings:
     - Local Port: 3000 → Container Port: 3000
   - Click "Apply"

---

## Common Synology-Specific Configurations

### Port Conflicts

Synology uses many ports. If 3000 is taken:

**Option A: Change in docker-compose.yml**
```yaml
ports:
  - "8080:3000"  # Use 8080 instead
```

**Option B: Via Container Manager GUI**
- Edit Container → Port Settings
- Change Local Port to an available port (e.g., 8080, 8888)
- Container Port stays 3000

**Check available ports**:
```bash
sudo netstat -tlnp | grep LISTEN
```

Common safe ports: 8080, 8888, 9000, 9090

### Volume Mapping (Optional)

To persist data across container updates:

**In docker-compose.yml**:
```yaml
volumes:
  - /volume1/docker/ziktok/data:/app/data
```

**In Container Manager GUI**:
- Container Settings → Volume
- Add Folder
- File/Folder: `/docker/ziktok/data`
- Mount Path: `/app/data`

### Network Configuration

**Bridge Mode (Default - Recommended)**
- Uses NAT, accessed via NAS IP + port
- Safest option

**Host Mode (Advanced)**
```yaml
network_mode: host
```
- Container uses NAS network directly
- Access on port 3000 directly
- May conflict with other services

### Environment Variables in GUI

Container Manager → Container → Edit → Environment

Add:
| Variable | Value |
|----------|-------|
| YOUTUBE_API_KEY | your_key_here |
| PORT | 3000 |
| NODE_ENV | production |

### Resource Limits via GUI

Container Manager → Container → Edit → Resource Limitation

Recommended settings:
- **Memory Limit**: 256 MB - 512 MB
- **CPU Priority**: Medium (50)
- **Enable auto-restart**: Yes

---

## Synology-Specific docker-compose.yml

If the default doesn't work, try this Synology-optimized version:

```yaml
version: '3.8'

services:
  ziktok:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ziktok
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
    # Synology volumes use /volume1 path
    # volumes:
    #   - /volume1/docker/ziktok/data:/app/data
    mem_limit: 256m
    cpus: 0.5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Firewall Configuration

If you can't access from outside your NAS:

1. **DSM → Control Panel → Security → Firewall**
2. Click "Edit Rules" for your firewall profile
3. Add rule:
   - Ports: Custom → 3000 (or your chosen port)
   - Protocol: TCP
   - Source IP: All or your network range
   - Action: Allow
4. Click "OK"

---

## Reverse Proxy Setup (Optional)

Access via HTTPS and custom domain:

### Step 1: Configure Reverse Proxy

1. **DSM → Control Panel → Login Portal → Advanced**
2. Click "Reverse Proxy" → "Create"
3. Settings:
   - Description: `ZikTok`
   - Source:
     - Protocol: HTTPS
     - Hostname: `ziktok.your-domain.com`
     - Port: 443
   - Destination:
     - Protocol: HTTP
     - Hostname: `localhost`
     - Port: 3000
   - Enable HSTS and HTTP/2

### Step 2: SSL Certificate

1. **DSM → Control Panel → Security → Certificate**
2. Add certificate (Let's Encrypt or custom)
3. Configure → Assign to reverse proxy

### Step 3: Access

- `https://ziktok.your-domain.com`

---

## Monitoring and Logs

### Container Manager GUI

1. **View Logs**
   - Container Manager → Container
   - Select `ziktok`
   - Click "Details" → "Log" tab
   - Real-time or download logs

2. **Monitor Resources**
   - Container → Details → "Terminal" tab
   - See CPU, Memory usage

### Command Line

```bash
# View logs
sudo docker logs ziktok -f

# Check stats
sudo docker stats ziktok

# Execute commands in container
sudo docker exec -it ziktok sh
```

---

## Updating the Application

### Method 1: Container Manager

1. Stop the container
2. Delete the container (not the image)
3. Update files via File Station
4. Create new container from updated files

### Method 2: Command Line

```bash
cd /volume1/docker/ziktok

# Pull latest code (if using git)
git pull

# Rebuild and restart
sudo docker-compose down
sudo docker-compose up -d --build

# Or just restart
sudo docker-compose restart
```

---

## Troubleshooting

### Container won't start

**Check logs**:
```bash
sudo docker logs ziktok
```

**Common causes**:
- Port already in use → Change port
- Missing .env file → Create it
- Invalid API key → Check your key
- Insufficient permissions → Run with sudo

### Can't access from browser

**Check container is running**:
```bash
sudo docker ps
```

**Check port mapping**:
```bash
sudo docker port ziktok
```

**Test from NAS terminal**:
```bash
curl http://localhost:3000
```

**Check firewall**:
- DSM → Control Panel → Security → Firewall
- Ensure port 3000 is allowed

### "Permission denied" errors

**Fix ownership** (if needed):
```bash
sudo chown -R 1001:1001 /volume1/docker/ziktok
```

### Out of memory

**Increase limit**:
- Container Manager → Container → Edit → Resource Limitation
- Increase Memory Limit to 512 MB or 1 GB

### Port already in use

**Find what's using the port**:
```bash
sudo netstat -tlnp | grep 3000
```

**Use different port**:
- Edit docker-compose.yml
- Change `"3000:3000"` to `"8080:3000"`
- Access on port 8080

---

## Auto-Start on Boot

Container Manager → Container → Select `ziktok` → Edit:
- Check "Enable auto-restart"
- This ensures the container starts when NAS boots

Or via docker-compose.yml:
```yaml
restart: always
```

---

## Backup Configuration

### Backup Files

Important files to backup:
- `/volume1/docker/ziktok/.env` (API key)
- `/volume1/docker/ziktok/docker-compose.yml` (configuration)
- Any custom modifications

### Hyper Backup

1. **Control Panel → Hyper Backup**
2. Create backup task
3. Include: `/docker/ziktok` folder

### Export Container Configuration

Container Manager → Container → Export settings
- Saves configuration for easy restore

---

## Performance Optimization

### NAS-Specific Settings

1. **Enable SSD Cache** (if you have SSD):
   - Storage Manager → SSD Cache
   - Improves container I/O performance

2. **Adjust Resource Limits**:
   ```yaml
   mem_limit: 512m  # Increase if NAS has RAM
   cpus: 1.0        # Increase if needed
   ```

3. **Use Host Network** (if no port conflicts):
   ```yaml
   network_mode: host
   ```

---

## Security Best Practices

1. **Keep .env file secure**:
   ```bash
   sudo chmod 600 /volume1/docker/ziktok/.env
   ```

2. **Enable HTTPS** via reverse proxy

3. **Restrict firewall** to your network only

4. **Regular updates**:
   ```bash
   cd /volume1/docker/ziktok
   git pull
   sudo docker-compose up -d --build
   ```

5. **Monitor logs** for suspicious activity

---

## Quick Reference

| Task | Container Manager GUI | Command Line |
|------|----------------------|--------------|
| Start | Toggle container on | `sudo docker-compose up -d` |
| Stop | Toggle container off | `sudo docker-compose down` |
| Restart | Container → Restart | `sudo docker-compose restart` |
| Logs | Details → Log tab | `sudo docker logs -f ziktok` |
| Update | Delete & recreate | `sudo docker-compose up -d --build` |
| Shell | Details → Terminal | `sudo docker exec -it ziktok sh` |

---

## Support

**Common NAS paths**:
- Docker directory: `/volume1/docker`
- Shared folders: `/volume1/homes` or `/volume1/<folder-name>`

**Useful commands**:
```bash
# Check Docker service
sudo synoservicectl --status pkgctl-Docker

# Restart Docker service (if needed)
sudo synoservicectl --restart pkgctl-Docker

# Check disk space
df -h
```

**Need help?**
- Check Container Manager logs: Container → Details → Log
- Check system logs: DSM → Log Center
- See main [README.md](README.md) for app-specific help

---

**Happy streaming on your Synology NAS! 🎬**
