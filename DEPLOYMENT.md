# ZikTok - Quick Deployment Guide

Choose your preferred deployment method below.

## 🐳 Docker (Recommended) - 2 Minutes

**Easiest and fastest deployment option**

### Prerequisites
- Docker and Docker Compose installed
- YouTube API key ([Get one here](https://console.cloud.google.com/apis/credentials))

### Steps

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd ZikTok
```

2. **Create .env file**
```bash
echo "YOUTUBE_API_KEY=your_youtube_api_key_here" > .env
```

3. **Start the application**
```bash
docker-compose up -d
```

4. **Access the app**
```
Open http://localhost:3000
```

### Management Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update and restart
git pull
docker-compose down
docker-compose up -d --build
```

---

## 🌐 Cloud Platforms

### Vercel (Serverless)
```bash
npm i -g vercel
vercel
# Add YOUTUBE_API_KEY in Vercel dashboard
```

### Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/ziktok
gcloud run deploy ziktok \
  --image gcr.io/PROJECT-ID/ziktok \
  --platform managed \
  --set-env-vars YOUTUBE_API_KEY=your_key
```

### Heroku
```bash
heroku create your-app-name
heroku config:set YOUTUBE_API_KEY=your_key
git push heroku main
```

### Railway
1. Connect GitHub repo at railway.app
2. Add environment variable: `YOUTUBE_API_KEY`
3. Deploy automatically

---

## 💻 Traditional Server (VPS)

### Using Docker on VPS
```bash
# Copy files to server
scp -r . user@your-server:/home/user/ziktok

# SSH into server
ssh user@your-server
cd /home/user/ziktok

# Create .env and start
echo "YOUTUBE_API_KEY=your_key" > .env
docker-compose up -d
```

### Using PM2 (without Docker)
```bash
# On your server
cd /home/user/ziktok
npm install
echo "YOUTUBE_API_KEY=your_key" > .env

# Install and start with PM2
npm install -g pm2
pm2 start server.js --name ziktok
pm2 save
pm2 startup  # Follow instructions
```

---

## 🔧 Post-Deployment

### Verify Installation
```bash
# Check if server is responding
curl http://localhost:3000

# Should return HTML content
```

### Add Channels
1. Open the app in your browser
2. Click settings icon (top left)
3. Search for channels (e.g., "dropout", "subway takes")
4. Add them to your feed
5. Start watching!

### Monitor Logs
```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs ziktok

# Direct Node
npm start  # See logs in terminal
```

---

## 🔒 Security Checklist

- [ ] Keep `.env` file secret (never commit to git)
- [ ] Use environment variables for API keys
- [ ] Enable HTTPS in production
- [ ] Set up firewall rules
- [ ] Keep Docker/Node.js updated
- [ ] Monitor API quota usage

---

## 📊 Resource Requirements

| Deployment | RAM | CPU | Disk | Notes |
|------------|-----|-----|------|-------|
| Docker | 256MB | 0.5 | 500MB | Recommended defaults |
| Node.js | 128MB | 0.25 | 100MB | Minimal setup |
| Cloud Run | 256MB | 1.0 | N/A | Auto-scales |
| Vercel | N/A | N/A | N/A | Serverless |

---

## 🆘 Quick Troubleshooting

### No videos showing
```bash
# Check API key is set
docker exec -it ziktok env | grep YOUTUBE_API_KEY

# Check logs
docker-compose logs -f
```

### Can't connect
```bash
# Check if container is running
docker ps

# Check port isn't blocked
telnet localhost 3000
```

### Out of memory
```bash
# Increase Docker memory limit
# Edit docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 512M
```

---

## 📚 Full Documentation

See [README.md](README.md) for complete documentation including:
- Architecture details
- API endpoints
- Customization guide
- Maintenance instructions

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Start | `docker-compose up -d` |
| Stop | `docker-compose down` |
| Logs | `docker-compose logs -f` |
| Restart | `docker-compose restart` |
| Update | `git pull && docker-compose up -d --build` |
| Health | `docker ps` (see STATUS) |

---

**Need help?** Check the [README.md](README.md) or open an issue.
