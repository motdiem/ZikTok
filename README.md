# ZikTok - YouTube Shorts PWA

A vanilla JavaScript Progressive Web App (PWA) that provides a TikTok-style interface for browsing YouTube Shorts from your favorite channels.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [How It Works](#how-it-works)
- [Key Components](#key-components)
- [API Endpoints](#api-endpoints)
- [Frontend Architecture](#frontend-architecture)
- [Data Flow](#data-flow)
- [Storage](#storage)
- [PWA Features](#pwa-features)
- [Customization](#customization)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Maintenance Guide](#maintenance-guide)

## Features

- 📱 **TikTok-style vertical video interface** - Swipe up/down to navigate
- 🎥 **YouTube Shorts integration** - Pulls shorts from your favorite channels
- 📊 **Watch history tracking** - Automatically tracks videos watched for more than 2 seconds
- 🚫 **24-hour replay prevention** - Skip videos you've already watched in the last 24 hours
- 🕐 **Browse watch history** - Quick access to previously watched videos with rewatch option
- 🔀 **Multiple sort modes** - Sort by date or random shuffle
- 🔇 **Mute control** - Toggle audio on/off
- 📤 **Share functionality** - Share videos directly from the app
- ⚙️ **Channel management** - Add/remove YouTube channels dynamically
- 📴 **Offline support** - PWA with service worker caching
- 🎯 **Vanilla JavaScript** - No frameworks, lightweight and fast
- 🖥️ **Keyboard navigation** - Arrow keys for desktop use

## Architecture Overview

ZikTok follows a **client-server architecture** with minimal server-side logic:

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                     │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ index.html │  │ style.css│  │     app.js      │ │
│  │  (UI)      │  │ (Styles) │  │ (Main Logic)    │ │
│  └────────────┘  └──────────┘  └─────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Service Worker (sw.js)                │  │
│  │  - Caching strategy                           │  │
│  │  - Offline support                            │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Express Server                  │
│  ┌──────────────────────────────────────────────┐  │
│  │           server.js (API Proxy)               │  │
│  │  - /api/channel/:id/shorts                    │  │
│  │  - /api/channel/search/:query                 │  │
│  │  - Static file serving                        │  │
│  │  - In-memory caching (1 hour TTL)             │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│            YouTube Data API v3                       │
│  - Channel information                               │
│  - Playlist items                                    │
│  - Video details (duration filtering)                │
└─────────────────────────────────────────────────────┘
```

### Why a Server Component?

While the goal was to be fully browser-based, YouTube's API requires:
1. **API Key protection** - Can't expose API keys in client-side code
2. **CORS restrictions** - YouTube API doesn't allow direct browser calls
3. **Rate limiting** - Server-side caching reduces API calls

The server is **minimal and stateless**, making it easy to deploy anywhere (Vercel, Heroku, Railway, etc.).

## Project Structure

```
ZikTok/
├── public/                 # Frontend files (served statically)
│   ├── index.html         # Main HTML structure
│   ├── style.css          # TikTok-style UI styling
│   ├── app.js             # Main application logic
│   ├── sw.js              # Service Worker (PWA offline support)
│   ├── manifest.json      # PWA manifest file
│   ├── icon-192.png       # PWA icon (192x192)
│   └── icon-512.png       # PWA icon (512x512)
├── server.js              # Express server (API proxy)
├── package.json           # Node.js dependencies
├── package-lock.json      # Locked dependency versions (for Docker)
├── Dockerfile             # Docker container definition
├── docker-compose.yml     # Docker Compose configuration
├── .dockerignore          # Docker build exclusions
├── docker-test.sh         # Docker deployment validation script
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment template
├── .gitignore             # Git ignore file
├── README.md              # This file (comprehensive documentation)
├── DEPLOYMENT.md          # Quick deployment reference
└── SYNOLOGY.md            # Synology NAS deployment guide
```

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A YouTube Data API v3 key

### Step 1: Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "YouTube Data API v3"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

### Step 2: Install Dependencies

```bash
# Clone or navigate to the project
cd ZikTok

# Install dependencies
npm install
```

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your YouTube API key
# YOUTUBE_API_KEY=your_actual_api_key_here
```

### Step 4: Run the Application

```bash
# Start the server
npm start

# Server will run on http://localhost:3000
```

### Step 5: Access the App

Open your browser and navigate to `http://localhost:3000`

## How It Works

### Application Flow

1. **Initialization** (`app.js:init()`)
   - Registers service worker for PWA functionality
   - Loads saved channels from localStorage
   - Loads watch history from localStorage
   - Cleans up history entries older than 24 hours
   - Sets up event listeners for UI interactions
   - Loads default channels if none exist
   - Fetches videos from all channels

2. **Video Loading** (`app.js:loadAllVideos()`)
   - Iterates through all saved channels
   - Calls server API to fetch shorts for each channel
   - Server fetches from YouTube API and filters for shorts (≤60s)
   - Combines all videos into a single array
   - Filters out videos watched in the last 24 hours (watched > 2 seconds)
   - Sorts videos based on selected mode (date/random)

3. **Video Rendering** (`app.js:createVideoSlides()`)
   - Creates 3 video slides: previous, current, next
   - Embeds YouTube iframe players
   - Positions slides using CSS transforms
   - Initializes YouTube Player API for control

4. **Navigation** (`app.js:nextVideo()/previousVideo()`)
   - Updates current index
   - Repositions slides with CSS animations
   - Loads new slides as needed
   - Plays current video, pauses others

5. **Touch/Swipe Detection** (`app.js:handleTouch*()`)
   - Tracks touch start/move/end positions
   - Calculates swipe distance and direction
   - Triggers navigation on threshold (50px)
   - Provides visual feedback during drag

## Key Components

### 1. Server (server.js)

**Purpose**: Proxies YouTube API requests and serves static files

**Key Features**:
- **In-memory caching**: Stores API responses for 1 hour to reduce quota usage
- **Two API endpoints**:
  - `GET /api/channel/:channelId/shorts` - Fetches shorts from a channel
  - `GET /api/channel/search/:query` - Searches for channels
- **Static file serving**: Serves the PWA files from `/public`

**Important Functions**:

```javascript
// Fetches and filters shorts
app.get('/api/channel/:channelId/shorts', async (req, res) => {
  // 1. Get channel's uploads playlist ID
  // 2. Fetch recent videos (max 50)
  // 3. Get video details
  // 4. Filter for duration ≤ 60 seconds
  // 5. Return shorts with metadata
});

// Parses ISO 8601 duration (e.g., PT1M30S = 90 seconds)
function parseDuration(duration) {
  // Extracts hours, minutes, seconds
  // Returns total seconds
}
```

**Caching Strategy**:
```javascript
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Check cache before API call
if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
  return res.json(cached.data);
}
```

### 2. Main Application (app.js)

**Purpose**: Core application logic and state management

**Class Structure**:
```javascript
class ZikTok {
  constructor() {
    // State management
    this.videos = [];                    // All loaded shorts
    this.currentIndex = 0;               // Current video position
    this.channels = [];                  // User's channel list
    this.sortMode = 'date';              // Sort mode
    this.isMuted = false;                // Audio state
    this.players = {};                   // YouTube player instances
    this.watchHistory = [];              // Watch history tracking
    this.currentVideoStartTime = null;   // Watch time tracking
    this.currentVideoWatchTime = 0;      // Accumulated watch time
  }
}
```

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `init()` | Initializes app, loads data, sets up listeners |
| `loadAllVideos()` | Fetches shorts from all channels |
| `filterUnwatchedVideos()` | Filters out videos watched in last 24 hours |
| `createVideoSlides()` | Renders video slides in DOM |
| `nextVideo()/previousVideo()` | Navigation between videos |
| `handleTouchStart/Move/End()` | Swipe gesture detection |
| `startWatchTimeTracking()` | Begins tracking watch time for current video |
| `saveCurrentVideoWatchTime()` | Saves accumulated watch time to history |
| `toggleMute()` | Controls audio state |
| `shareVideo()` | Native share or clipboard copy |
| `openSettings()/closeSettings()` | Settings modal control |
| `openHistory()/closeHistory()` | Watch history modal control |
| `renderHistoryList()` | Displays watch history entries |
| `rewatchVideo()` | Plays a video from watch history |
| `addChannel()/removeChannel()` | Channel management |
| `saveChannels()/loadChannels()` | localStorage persistence |
| `loadWatchHistory()/saveWatchHistory()` | Watch history persistence |
| `cleanupWatchHistory()` | Removes entries older than 24 hours |

**State Flow**:
```
User opens app
    ↓
Load channels from localStorage
    ↓
Fetch shorts from server API
    ↓
Sort videos (date/random)
    ↓
Create video slides (prev, current, next)
    ↓
Play current video
    ↓
User swipes → Update index → Reposition slides
```

### 3. User Interface (index.html + style.css)

**Layout Structure**:
```html
<body>
  <!-- Loading screen -->
  <div id="loading-screen">...</div>

  <!-- Video container (swipeable) -->
  <div id="video-container">
    <!-- Dynamically created slides -->
  </div>

  <!-- Top bar (history, settings, sort buttons) -->
  <div class="top-bar">...</div>

  <!-- Right controls (mute, share) -->
  <div class="video-controls">...</div>

  <!-- Bottom video info -->
  <div class="video-info">...</div>

  <!-- Settings modal -->
  <div id="settings-modal">...</div>

  <!-- Watch history modal -->
  <div id="history-modal">...</div>
</body>
```

**CSS Architecture**:

1. **Full-screen layout**: `body` is `position: fixed` with `overflow: hidden`
2. **Video slides**: Positioned absolutely with `transform: translateY()`
   - `.prev` → `translateY(-100%)`
   - `.active` → `translateY(0)`
   - `.next` → `translateY(100%)`
3. **Aspect ratio**: Media query ensures 9:16 ratio for vertical videos
4. **Z-index layers**:
   - Base (0): Video slides
   - Mid (50): Swipe hint
   - High (100): Controls, info
   - Modal (1000): Settings modal
   - Loading (9999): Loading screen

### 4. Service Worker (sw.js)

**Purpose**: Enables offline functionality and faster loading

**Caching Strategy**:

| Resource Type | Strategy | Reason |
|---------------|----------|--------|
| Static assets (HTML, CSS, JS) | Cache-first | Rarely change, fast offline access |
| API calls (`/api/*`) | Network-first | Always need fresh data |
| Other requests | Cache-first with network fallback | Best of both worlds |

**Lifecycle**:
```javascript
// Install: Cache static assets
self.addEventListener('install', (event) => {
  caches.open('ziktok-v1').then(cache =>
    cache.addAll(['/index.html', '/style.css', '/app.js'])
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  // Delete caches that don't match current version
});

// Fetch: Serve from cache or network
self.addEventListener('fetch', (event) => {
  // Different strategies based on request type
});
```

## API Endpoints

### GET /api/channel/:channelId/shorts

Fetches YouTube Shorts from a specific channel.

**Parameters**:
- `channelId` (path): YouTube channel ID (e.g., `UCOJhfNGIDalQNUGAJyJZ5KA`)

**Response**:
```json
{
  "shorts": [
    {
      "id": "abc123",
      "title": "Video Title",
      "channelTitle": "Channel Name",
      "publishedAt": "2024-01-01T12:00:00Z",
      "thumbnail": "https://...",
      "description": "Video description"
    }
  ],
  "channelId": "UCOJhfNGIDalQNUGAJyJZ5KA",
  "channelTitle": "Dropout"
}
```

**Caching**: Responses cached for 1 hour

### GET /api/channel/search/:query

Searches for YouTube channels by name.

**Parameters**:
- `query` (path): Search query (e.g., `dropout`)

**Response**:
```json
{
  "channels": [
    {
      "id": "UCOJhfNGIDalQNUGAJyJZ5KA",
      "title": "Dropout",
      "thumbnail": "https://...",
      "description": "Channel description"
    }
  ]
}
```

## Frontend Architecture

### Video Slide Management

The app maintains 3 video slides at any time for smooth transitions:

```
Index 0  Index 1  Index 2  Index 3  Index 4
  ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐
  │ 0 │    │ 1 │    │ 2 │    │ 3 │    │ 4 │
  └───┘    └───┘    └───┘    └───┘    └───┘
            ↑        ↑        ↑
           PREV   CURRENT   NEXT
```

When user swipes to next:
1. Current → Prev
2. Next → Current
3. Create new Next slide
4. Remove old Prev slide

**Benefits**:
- Smooth transitions
- Pre-loads next video
- Minimal DOM manipulation
- Low memory usage

### YouTube Player Integration

Videos are embedded using YouTube's iframe embed with parameters:

```javascript
const iframe = document.createElement('iframe');
iframe.src = `https://www.youtube.com/embed/${videoId}?
  enablejsapi=1        // Enable JavaScript API
  &autoplay=1          // Auto-play on load
  &mute=0              // Mute state
  &controls=0          // Hide controls
  &modestbranding=1    // Minimal YouTube branding
  &rel=0               // Don't show related videos
  &cc_load_policy=1    // Enable captions
`;
```

**Control via postMessage**:
```javascript
iframe.contentWindow.postMessage(
  '{"event":"command","func":"playVideo","args":""}',
  '*'
);
```

Supported commands: `playVideo`, `pauseVideo`, `mute`, `unMute`

## Data Flow

### Loading Videos

```
User opens app
    ↓
app.js calls loadAllVideos()
    ↓
For each channel:
    ↓
    fetch('/api/channel/{id}/shorts')
        ↓
        server.js receives request
        ↓
        Check cache (1 hour TTL)
        ↓
        If not cached:
            ↓
            Call YouTube API (3 steps):
            1. Get channel details
            2. Get playlist items
            3. Get video details + filter by duration
        ↓
        Return shorts array
    ↓
Combine all shorts
    ↓
Sort by date or random
    ↓
Create video slides
    ↓
Render in DOM
```

### Managing Channels

```
User clicks "Add Channel"
    ↓
Enter search query
    ↓
fetch('/api/channel/search/{query}')
    ↓
Display search results
    ↓
User clicks "Add"
    ↓
app.addChannel(channel)
    ↓
Update this.channels array
    ↓
localStorage.setItem('ziktok_channels', JSON.stringify(channels))
    ↓
Reload all videos
```

## Storage

### LocalStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `ziktok_channels` | JSON array | Stores user's channel list |
| `ziktok_watch_history` | JSON array | Stores watch history with timestamps and watch times |
| `ziktok_seen_hint` | Boolean | Whether user has seen swipe hint |

**Channel Object Structure**:
```javascript
{
  id: "UCxxx...",           // YouTube channel ID
  title: "Channel Name",    // Display name
  thumbnail: "https://..."  // Channel avatar URL
}
```

**Watch History Entry Structure**:
```javascript
{
  videoId: "abc123",                    // YouTube video ID
  title: "Video Title",                 // Video title
  channelTitle: "Channel Name",         // Channel name
  thumbnail: "https://...",             // Video thumbnail URL
  timestamp: 1704110400000,             // Unix timestamp (ms) when watched
  watchTime: 15.5                       // Total seconds watched
}
```

### Server-Side Cache

In-memory Map with timestamp:
```javascript
cache = {
  'channel_UCxxx...': {
    data: { shorts: [...], channelId: '...', channelTitle: '...' },
    timestamp: 1704110400000
  }
}
```

**Cache Invalidation**: Automatic after 1 hour (3600000ms)

## PWA Features

### Manifest (manifest.json)

Defines app metadata for installation:

```json
{
  "name": "ZikTok - YouTube Shorts Viewer",
  "short_name": "ZikTok",
  "display": "standalone",        // Full-screen, no browser UI
  "orientation": "portrait",      // Lock to portrait mode
  "theme_color": "#000000",       // Black theme
  "icons": [...]                  // App icons
}
```

### Service Worker Features

1. **Offline Assets**: Core files (HTML, CSS, JS) cached for offline access
2. **Network-First API**: Always tries to fetch fresh data, falls back to cache
3. **Cache Cleanup**: Removes old cache versions on update
4. **Graceful Degradation**: Shows offline message if API unavailable

### Installation

On compatible browsers (Chrome, Edge, Safari on iOS):
- Browser shows "Install App" prompt
- User can add to home screen
- Launches as standalone app

## Customization

### Changing Default Channels

Edit `app.js` around line 50:

```javascript
if (this.channels.length === 0) {
  this.channels = [
    { id: 'UCOJhfNGIDalQNUGAJyJZ5KA', title: 'Dropout', thumbnail: '' },
    { id: 'UC_YOUR_CHANNEL_ID', title: 'Your Channel', thumbnail: '' }
  ];
  this.saveChannels();
}
```

### Adjusting Swipe Sensitivity

Edit `app.js` around line 420:

```javascript
// Change threshold from 50px to desired value
if (this.dragDistance > 50) {  // Make larger for less sensitive
  this.nextVideo();
}
```

### Modifying Cache Duration

Edit `server.js` line 9:

```javascript
const CACHE_DURATION = 60 * 60 * 1000; // Change to desired milliseconds
```

### Changing Video Limit Per Channel

Edit `server.js` line 42:

```javascript
maxResults=50  // Change to 10-50 (YouTube API limit is 50)
```

### Adjusting Watch History Settings

**Change 24-hour period** - Edit `app.js` around line 753:
```javascript
const twentyFourHours = 24 * 60 * 60 * 1000;  // Change hours value
```

**Change minimum watch time** - Edit `app.js` around line 772:
```javascript
if (watchEntry.watchTime < 2) return true;  // Change from 2 seconds
```

**Disable replay prevention** - Edit `app.js` around line 168, comment out:
```javascript
// this.videos = this.filterUnwatchedVideos(this.videos);
```

### Styling Changes

Key CSS variables and values in `style.css`:

- **Background color**: Line 7: `background: #000;`
- **Control button size**: Line 145: `width: 50px; height: 50px;`
- **Transition speed**: Line 31: `transition: transform 0.3s`
- **Top bar height**: Line 111: `height: 60px;`

## Deployment

**Quick Start Guides:**
- 🐳 **Docker/General**: See [DEPLOYMENT.md](DEPLOYMENT.md) for quick reference
- 🏠 **Synology NAS**: See [SYNOLOGY.md](SYNOLOGY.md) for Container Manager setup
- 📖 **Detailed options**: Continue reading below

### Option 1: Vercel (Recommended for Serverless)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable in Vercel dashboard
# YOUTUBE_API_KEY = your_key
```

### Option 2: Heroku

```bash
# Create Procfile
echo "web: node server.js" > Procfile

# Deploy
heroku create your-app-name
heroku config:set YOUTUBE_API_KEY=your_key
git push heroku main
```

### Option 3: Railway

1. Connect GitHub repo
2. Add environment variable: `YOUTUBE_API_KEY`
3. Deploy automatically

### Option 4: Traditional VPS

```bash
# Install Node.js and npm
# Clone repo
# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Create .env file
echo "YOUTUBE_API_KEY=your_key" > .env

# Start with PM2
pm2 start server.js --name ziktok
pm2 save
pm2 startup  # Follow instructions

# Setup nginx reverse proxy (optional)
```

### Option 5: Docker (Recommended for Production)

Docker provides the easiest and most consistent deployment experience. The application uses **node:18-alpine**, the lightest official Node.js image (~40MB base).

#### Quick Start with Docker Compose

**Prerequisites**: Docker and Docker Compose installed

1. **Create .env file** in project root:
```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
```

2. **Start the application**:
```bash
docker-compose up -d
```

3. **Access the app**: Open http://localhost:3000

4. **View logs**:
```bash
docker-compose logs -f ziktok
```

5. **Stop the application**:
```bash
docker-compose down
```

#### Manual Docker Build

If you prefer not to use Docker Compose:

```bash
# Build the image
docker build -t ziktok:latest .

# Run the container
docker run -d \
  --name ziktok \
  -p 3000:3000 \
  -e YOUTUBE_API_KEY=your_youtube_api_key_here \
  --restart unless-stopped \
  ziktok:latest

# View logs
docker logs -f ziktok

# Stop the container
docker stop ziktok
docker rm ziktok
```

#### Docker Image Features

- **Base Image**: `node:18-alpine` (~180MB final size)
- **Non-root user**: Runs as user `nodejs` for security
- **Health checks**: Automatic container health monitoring
- **Production optimized**: Only production dependencies installed
- **Resource limits**: Default 256MB RAM, 0.5 CPU (configurable)
- **Auto-restart**: Container restarts on failure

#### Advanced Configuration

**Custom port mapping**:
```bash
docker run -d -p 8080:3000 -e PORT=3000 -e YOUTUBE_API_KEY=your_key ziktok:latest
# Access on http://localhost:8080
```

**Resource limits**:
```bash
docker run -d \
  --memory="512m" \
  --cpus="1.0" \
  -p 3000:3000 \
  -e YOUTUBE_API_KEY=your_key \
  ziktok:latest
```

**With persistent data** (for future features):
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e YOUTUBE_API_KEY=your_key \
  ziktok:latest
```

#### Docker Compose Configuration

The `docker-compose.yml` file includes:
- Automatic health checks
- Resource limits (256MB RAM, 0.5 CPU)
- Auto-restart policy
- Log rotation (10MB max, 3 files)
- Environment variable injection

**Modify docker-compose.yml** to change settings:
```yaml
# Change port
ports:
  - "8080:3000"

# Adjust resources
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '1.0'
```

#### Deployment to Cloud Platforms

**Deploy to Docker-enabled VPS**:
```bash
# Copy files to server
scp -r . user@your-server:/path/to/ziktok

# SSH into server
ssh user@your-server

# Navigate and start
cd /path/to/ziktok
docker-compose up -d
```

**Deploy to AWS ECS/Fargate**:
```bash
# Build and tag
docker build -t ziktok:latest .
docker tag ziktok:latest your-account.dkr.ecr.region.amazonaws.com/ziktok:latest

# Push to ECR
aws ecr get-login-password --region region | docker login --username AWS --password-stdin your-account.dkr.ecr.region.amazonaws.com
docker push your-account.dkr.ecr.region.amazonaws.com/ziktok:latest

# Deploy using ECS task definition
```

**Deploy to Google Cloud Run**:
```bash
# Build and submit
gcloud builds submit --tag gcr.io/PROJECT-ID/ziktok

# Deploy
gcloud run deploy ziktok \
  --image gcr.io/PROJECT-ID/ziktok \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars YOUTUBE_API_KEY=your_key
```

**Deploy to Azure Container Instances**:
```bash
# Build and push to ACR
az acr build --registry your-registry --image ziktok:latest .

# Deploy
az container create \
  --resource-group your-rg \
  --name ziktok \
  --image your-registry.azurecr.io/ziktok:latest \
  --dns-name-label ziktok \
  --ports 3000 \
  --environment-variables YOUTUBE_API_KEY=your_key
```

#### Docker Healthcheck

The container includes a built-in healthcheck that:
- Runs every 30 seconds
- Checks if the server responds on port 3000
- Marks container unhealthy after 3 failed attempts
- Allows 5 seconds startup time

View health status:
```bash
docker ps  # See health status in STATUS column
docker inspect ziktok | grep -A 10 Health
```

#### Dockerfile Optimization

The included Dockerfile follows best practices:
1. **Multi-layer caching**: Package.json copied first for better cache utilization
2. **Minimal dependencies**: `npm ci --only=production` installs only required packages
3. **Cache cleanup**: `npm cache clean --force` reduces image size
4. **Non-root execution**: Security best practice
5. **Explicit port exposure**: Documents container networking
6. **Health monitoring**: Automatic health status reporting

#### Troubleshooting Docker Deployment

**Container won't start**:
```bash
# Check logs
docker logs ziktok

# Check if port is already in use
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

**Can't connect to container**:
```bash
# Verify container is running
docker ps

# Check port mapping
docker port ziktok

# Test from inside container
docker exec -it ziktok sh
wget -O- http://localhost:3000
```

**Image too large**:
```bash
# Check image size
docker images ziktok

# Should be ~180MB. If larger, check .dockerignore
```

**Out of memory errors**:
```bash
# Increase memory limit
docker update --memory="512m" ziktok

# Or in docker-compose.yml
```

## Troubleshooting

### No videos showing

**Causes**:
1. Invalid YouTube API key
2. No channels added
3. Channels have no shorts
4. API quota exceeded

**Solutions**:
1. Check `.env` file has correct `YOUTUBE_API_KEY`
2. Check server logs: `npm start` should show "YouTube API Key configured: Yes"
3. Try adding a channel you know has shorts
4. Check [Google Cloud Console](https://console.cloud.google.com/) for quota

### Videos not playing

**Causes**:
1. YouTube embed restrictions
2. Ad blockers
3. Network issues

**Solutions**:
1. Some videos can't be embedded (rare for shorts)
2. Disable ad blockers temporarily
3. Check browser console for errors

### Swipe not working

**Causes**:
1. Touch events not supported
2. JavaScript error

**Solutions**:
1. Use keyboard arrows (desktop)
2. Check browser console for errors
3. Try refreshing the page

### Settings not saving

**Causes**:
1. localStorage disabled
2. Private/incognito mode

**Solutions**:
1. Check browser settings
2. Use normal browsing mode

### PWA not installing

**Causes**:
1. Not served over HTTPS
2. No service worker
3. Manifest issues

**Solutions**:
1. Deploy to HTTPS host or use localhost
2. Check service worker registration in DevTools
3. Validate manifest.json

## Maintenance Guide

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update packages
npm update

# For major updates
npm install express@latest
```

### Monitoring API Usage

YouTube API has daily quotas:
- Free tier: 10,000 units/day
- Each video list call: ~3-5 units
- Each search: ~100 units

**Check usage**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → YouTube Data API v3

### Cache Management

Current cache is in-memory (clears on restart). For production, consider:

1. **Redis** (persistent cache):
```javascript
const redis = require('redis');
const client = redis.createClient();
```

2. **File-based cache**:
```javascript
const fs = require('fs');
const CACHE_FILE = './cache.json';
```

### Adding New Features

**Example: Add like/dislike tracking**

1. Update state in `app.js`:
```javascript
constructor() {
  this.likedVideos = this.loadLikedVideos();
}
```

2. Add UI in `index.html`:
```html
<button id="like-btn" class="control-btn">❤️</button>
```

3. Add event listener:
```javascript
document.getElementById('like-btn').addEventListener('click', () => this.toggleLike());
```

4. Implement method:
```javascript
toggleLike() {
  const videoId = this.videos[this.currentIndex].id;
  if (this.likedVideos.includes(videoId)) {
    this.likedVideos = this.likedVideos.filter(id => id !== videoId);
  } else {
    this.likedVideos.push(videoId);
  }
  localStorage.setItem('ziktok_liked', JSON.stringify(this.likedVideos));
}
```

### Code Organization Tips

1. **Keep server.js focused**: Only API proxy, no business logic
2. **Use class methods**: Group related functionality
3. **Comment complex logic**: Especially API interactions
4. **Handle errors gracefully**: Always try/catch async operations
5. **Test on mobile**: Primary use case is mobile browsers

### Performance Optimization

1. **Limit simultaneous videos**: Already done (3 slides max)
2. **Lazy load thumbnails**: Consider for channel list
3. **Debounce search**: Add delay before API call
4. **Reduce API calls**: Increase cache duration if needed
5. **Minimize DOM updates**: Use DocumentFragment for bulk updates

## License

MIT License - Feel free to modify and distribute

## Credits

- YouTube Data API v3 for video data
- YouTube IFrame Player API for video playback
- Inspired by TikTok's user interface

---

**Questions or Issues?**
Check the code comments or open an issue on GitHub.
