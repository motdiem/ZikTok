# Multi-Platform Implementation Checklist

Quick reference checklist for adding TikTok and Instagram support to ZikTok.

---

## Pre-Implementation Setup

### TikTok Setup
- [ ] Create TikTok Developer account at [developers.tiktok.com](https://developers.tiktok.com)
- [ ] Register new app in TikTok Developer Portal
- [ ] Note down Client Key and Client Secret
- [ ] (Optional) Sign up for TikAPI.io or similar service for non-auth video discovery

### Instagram Setup (Phase 2 - Optional)
- [ ] Create Facebook Developer account
- [ ] Create new Facebook App
- [ ] Add Instagram Graph API product
- [ ] Configure OAuth redirect URIs
- [ ] Request Instagram permissions: `instagram_basic`, `instagram_content_publish`

### Environment Configuration
- [ ] Add to `.env`:
  ```bash
  TIKTOK_CLIENT_KEY=your_client_key_here
  TIKTOK_CLIENT_SECRET=your_client_secret_here
  TIKAPI_KEY=your_tikapi_key_here  # If using third-party
  INSTAGRAM_APP_ID=your_app_id_here  # Phase 2
  INSTAGRAM_APP_SECRET=your_app_secret_here  # Phase 2
  ```

---

## Phase 1: Foundation (Week 1)

### Data Model Updates

#### File: `public/app.js`

- [ ] **Update constructor** (lines ~7-10)
  ```javascript
  // OLD: this.channels = this.loadChannels();
  // NEW: this.sources = this.loadSources();
  ```

- [ ] **Rename localStorage methods** (lines ~659-673)
  ```javascript
  // OLD: loadChannels() / saveChannels()
  // NEW: loadSources() / saveSources()
  // Update localStorage key: 'ziktok_channels' → 'ziktok_sources'
  ```

- [ ] **Update source object structure**
  ```javascript
  // OLD: { id, title, thumbnail }
  // NEW: { platform: 'youtube'|'tiktok'|'instagram', id, title, thumbnail }
  ```

- [ ] **Add data migration for existing users**
  ```javascript
  migrateLegacyChannels() {
    const oldChannels = localStorage.getItem('ziktok_channels');
    if (oldChannels) {
      const channels = JSON.parse(oldChannels);
      const sources = channels.map(ch => ({
        platform: 'youtube',
        id: ch.id,
        title: ch.title,
        thumbnail: ch.thumbnail
      }));
      localStorage.setItem('ziktok_sources', JSON.stringify(sources));
      localStorage.removeItem('ziktok_channels');
    }
  }
  ```

### Video Object Normalization

- [ ] **Update video object structure** (throughout app.js)
  ```javascript
  // Add these fields to all video objects:
  {
    platform: 'youtube' | 'tiktok' | 'instagram',
    sourceId: '...', // channel ID or username
    sourceTitle: '...', // display name
    embedUrl: '...', // platform-specific embed URL
    // ... existing fields: id, title, thumbnail, publishedAt
  }
  ```

### UI Updates

#### File: `public/index.html`

- [ ] **Update settings modal** - Add platform selector
  ```html
  <div class="source-type-selector">
    <label for="platform-select">Platform:</label>
    <select id="platform-select">
      <option value="youtube">YouTube Channel</option>
      <option value="tiktok">TikTok User</option>
      <!-- <option value="instagram">Instagram (Coming Soon)</option> -->
    </select>
  </div>

  <div id="youtube-input" class="platform-input">
    <input id="channel-search-input" type="text" placeholder="Search YouTube channels">
    <button id="search-channel-btn">Search</button>
  </div>

  <div id="tiktok-input" class="platform-input" style="display:none">
    <input id="tiktok-username-input" type="text" placeholder="@username">
    <button id="add-tiktok-btn">Add User</button>
  </div>
  ```

- [ ] **Update sources list display** - Add platform badges
  ```html
  <div class="source-item">
    <span class="platform-badge platform-youtube">YT</span>
    <span class="source-title">Channel Name</span>
    <button class="remove-source-btn">Remove</button>
  </div>
  ```

#### File: `public/style.css`

- [ ] **Add platform badge styles**
  ```css
  .platform-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    margin-right: 8px;
  }

  .platform-youtube {
    background: #FF0000;
    color: white;
  }

  .platform-tiktok {
    background: #000000;
    color: #00F2EA;
  }

  .platform-instagram {
    background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
    color: white;
  }
  ```

- [ ] **Add platform input toggle styles**
  ```css
  .platform-input {
    margin: 10px 0;
  }

  .platform-input.hidden {
    display: none;
  }
  ```

### Event Handlers

#### File: `public/app.js`

- [ ] **Add platform selector event listener**
  ```javascript
  document.getElementById('platform-select').addEventListener('change', (e) => {
    this.handlePlatformChange(e.target.value);
  });
  ```

- [ ] **Implement platform change handler**
  ```javascript
  handlePlatformChange(platform) {
    // Hide all platform inputs
    document.querySelectorAll('.platform-input').forEach(el => {
      el.style.display = 'none';
    });

    // Show selected platform input
    if (platform === 'youtube') {
      document.getElementById('youtube-input').style.display = 'block';
    } else if (platform === 'tiktok') {
      document.getElementById('tiktok-input').style.display = 'block';
    }
  }
  ```

---

## Phase 2: TikTok Backend (Week 2)

### Server Endpoints

#### File: `server.js`

- [ ] **Add TikTok oEmbed helper function**
  ```javascript
  // Add after YouTube helpers (around line 140)

  async function getTikTokOEmbed(videoUrl) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
      const response = await fetch(oembedUrl);
      if (!response.ok) {
        throw new Error(`oEmbed failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('TikTok oEmbed error:', error);
      return null;
    }
  }
  ```

- [ ] **Option A: Add third-party API endpoint** (if using TikAPI.io)
  ```javascript
  app.get('/api/tiktok/:username/videos', async (req, res) => {
    try {
      const { username } = req.params;
      const maxResults = Math.min(parseInt(req.query.maxResults) || 20, 50);
      const cacheKey = `tiktok_${username}_${maxResults}`;

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return res.json(cached.data);
      }

      // Fetch from TikAPI (replace with your API)
      const tikApiUrl = `https://api.tikapi.io/public/check?username=${username}`;
      const tikApiResponse = await fetch(tikApiUrl, {
        headers: {
          'X-API-KEY': process.env.TIKAPI_KEY
        }
      });

      const tikApiData = await tikApiResponse.json();
      const videos = tikApiData.videos || [];

      // Enrich with oEmbed data
      const enrichedVideos = await Promise.all(
        videos.slice(0, maxResults).map(async (video) => {
          const videoUrl = `https://www.tiktok.com/@${username}/video/${video.id}`;
          const oembed = await getTikTokOEmbed(videoUrl);

          return {
            id: video.id,
            title: oembed?.title || video.desc || '',
            sourceTitle: username,
            thumbnail: oembed?.thumbnail_url || video.cover,
            embedUrl: `https://www.tiktok.com/embed/v2/${video.id}`,
            publishedAt: video.createTime,
            duration: video.duration || 0,
            platform: 'tiktok'
          };
        })
      );

      const result = {
        videos: enrichedVideos,
        username,
        platform: 'tiktok'
      };

      // Cache result
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      res.json(result);
    } catch (error) {
      console.error('TikTok API error:', error);
      res.status(500).json({ error: 'Failed to fetch TikTok videos', details: error.message });
    }
  });
  ```

- [ ] **Option B: Add TikTok Display API endpoint** (OAuth approach)
  ```javascript
  app.get('/api/tiktok/user/videos', async (req, res) => {
    try {
      const accessToken = req.query.access_token;
      if (!accessToken) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const maxResults = Math.min(parseInt(req.query.max_count) || 20, 20);

      const response = await fetch(
        `https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,embed_link,create_time&max_count=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const videos = data.data.videos.map(v => ({
        id: v.id,
        title: v.title || v.video_description || '',
        sourceTitle: 'Your TikTok', // Would need user info API call
        thumbnail: v.cover_image_url,
        embedUrl: v.embed_link,
        publishedAt: v.create_time,
        duration: v.duration,
        platform: 'tiktok'
      }));

      res.json({ videos, platform: 'tiktok' });
    } catch (error) {
      console.error('TikTok Display API error:', error);
      res.status(500).json({ error: 'Failed to fetch TikTok videos', details: error.message });
    }
  });
  ```

- [ ] **Add TikTok OAuth endpoints** (if using Display API)
  ```javascript
  // OAuth initiation
  app.get('/api/tiktok/oauth/authorize', (req, res) => {
    const csrfState = Math.random().toString(36).substring(2);
    res.cookie('csrfState', csrfState, { maxAge: 60000 });

    let url = 'https://www.tiktok.com/v2/auth/authorize/';
    url += `?client_key=${process.env.TIKTOK_CLIENT_KEY}`;
    url += '&scope=user.info.basic,video.list';
    url += '&response_type=code';
    url += `&redirect_uri=${encodeURIComponent(process.env.TIKTOK_REDIRECT_URI)}`;
    url += `&state=${csrfState}`;

    res.redirect(url);
  });

  // OAuth callback
  app.get('/api/tiktok/oauth/callback', async (req, res) => {
    const { code, state } = req.query;

    // Verify CSRF state
    if (state !== req.cookies.csrfState) {
      return res.status(403).send('CSRF verification failed');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY,
          client_secret: process.env.TIKTOK_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.TIKTOK_REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description);
      }

      // Store token (in production, use secure session/database)
      // For now, return to client to handle
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'TIKTOK_AUTH_SUCCESS',
            accessToken: '${tokenData.access_token}',
            refreshToken: '${tokenData.refresh_token}',
            expiresIn: ${tokenData.expires_in}
          }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('TikTok OAuth error:', error);
      res.status(500).send('Authentication failed');
    }
  });
  ```

---

## Phase 3: Multi-Platform Video Loading (Week 2-3)

### Frontend Integration

#### File: `public/app.js`

- [ ] **Update loadAllVideos method** (lines ~164-225)
  ```javascript
  async loadAllVideos() {
    if (this.isLoadingVideos) return;
    if (this.sources.length === 0) return;

    this.isLoadingVideos = true;
    this.showLoading();

    try {
      const targetTotal = 100;
      const videosPerSource = Math.max(Math.floor(targetTotal / this.sources.length), 10);

      // Group sources by platform
      const youtubeIds = this.sources.filter(s => s.platform === 'youtube').map(s => s.id);
      const tiktokUsers = this.sources.filter(s => s.platform === 'tiktok').map(s => s.id);
      const instagramUsers = this.sources.filter(s => s.platform === 'instagram').map(s => s.id);

      // Fetch from all platforms in parallel
      const fetchPromises = [
        ...youtubeIds.map(id => this.fetchYouTubeShorts(id, videosPerSource)),
        ...tiktokUsers.map(user => this.fetchTikTokVideos(user, videosPerSource)),
        ...instagramUsers.map(user => this.fetchInstagramReels(user, videosPerSource))
      ];

      const results = await Promise.all(fetchPromises);

      // Flatten and normalize
      this.videos = results
        .filter(result => result && result.videos)
        .flatMap(result => result.videos);

      // Filter unwatched
      this.videos = this.filterUnwatchedVideos(this.videos);

      // Apply sort
      this.applySortMode();

      // Render
      if (this.videos.length > 0) {
        this.createVideoSlides();
      } else {
        this.showNoVideosMessage();
      }
    } catch (error) {
      console.error('Error loading videos:', error);
      this.showErrorMessage('Failed to load videos. Please try again.');
    } finally {
      this.isLoadingVideos = false;
      this.hideLoading();
    }
  }
  ```

- [ ] **Rename fetchChannelShorts to fetchYouTubeShorts**
  ```javascript
  async fetchYouTubeShorts(channelId, maxResults = 50) {
    // Existing implementation, just renamed
    // Add platform: 'youtube' to each video object
  }
  ```

- [ ] **Add fetchTikTokVideos method**
  ```javascript
  async fetchTikTokVideos(username, maxResults = 20) {
    try {
      // Remove @ if present
      username = username.replace('@', '');

      const response = await fetch(`/api/tiktok/${username}/videos?maxResults=${maxResults}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Normalize video objects
      const videos = data.videos.map(v => ({
        ...v,
        platform: 'tiktok',
        sourceId: username,
        sourceTitle: data.username || username
      }));

      return { videos, username };
    } catch (error) {
      console.error(`Error fetching TikTok videos for @${username}:`, error);
      return { videos: [], error: error.message };
    }
  }
  ```

- [ ] **Add fetchInstagramReels stub** (Phase 2)
  ```javascript
  async fetchInstagramReels(username, maxResults = 20) {
    // TODO: Implement in Phase 2
    console.log('Instagram integration coming soon');
    return { videos: [] };
  }
  ```

- [ ] **Update addSource method** (replace addChannel)
  ```javascript
  async addSource() {
    const platform = document.getElementById('platform-select').value;

    if (platform === 'youtube') {
      await this.addYouTubeChannel();
    } else if (platform === 'tiktok') {
      await this.addTikTokUser();
    } else if (platform === 'instagram') {
      await this.addInstagramUser();
    }
  }

  async addTikTokUser() {
    const input = document.getElementById('tiktok-username-input');
    let username = input.value.trim();

    if (!username) {
      alert('Please enter a TikTok username');
      return;
    }

    // Remove @ if present
    username = username.replace('@', '');

    // Check if already added
    if (this.sources.some(s => s.platform === 'tiktok' && s.id === username)) {
      alert('This TikTok user is already added');
      return;
    }

    // Add source
    this.sources.push({
      platform: 'tiktok',
      id: username,
      title: `@${username}`,
      thumbnail: '' // TikTok user avatar would need separate API call
    });

    this.saveSources();
    this.renderSourcesList();
    input.value = '';

    // Reload videos
    await this.loadAllVideos();
  }
  ```

---

## Phase 4: Multi-Platform Video Player (Week 3)

### Video Slide Creation

#### File: `public/app.js`

- [ ] **Update createVideoSlide method** (lines ~254-317)
  ```javascript
  createVideoSlide(video, position) {
    const slide = document.createElement('div');
    slide.className = `video-slide ${position}`;
    slide.dataset.videoId = video.id;
    slide.dataset.platform = video.platform;

    // Create iframe based on platform
    const iframe = this.createPlatformIframe(video, position);
    slide.appendChild(iframe);

    // Store iframe reference
    if (position === 'active') {
      this.players[this.currentIndex] = iframe;
    }

    return slide;
  }

  createPlatformIframe(video, position) {
    const iframe = document.createElement('iframe');
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; fullscreen';
    iframe.style.pointerEvents = 'none'; // Allow swipe gestures

    // Determine if should autoplay (only active slide)
    const shouldAutoplay = position === 'active';
    const shouldMute = this.isMuted ? 1 : 0;

    // Platform-specific iframe setup
    if (video.platform === 'youtube') {
      iframe.src = `https://www.youtube.com/embed/${video.id}?` +
        `enablejsapi=1&autoplay=${shouldAutoplay ? 1 : 0}&mute=${shouldMute}` +
        `&controls=0&modestbranding=1&rel=0&cc_load_policy=1` +
        `&playsinline=1&loop=1&playlist=${video.id}`;
      iframe.className = 'youtube-player';

    } else if (video.platform === 'tiktok') {
      // TikTok embed
      iframe.src = video.embedUrl || `https://www.tiktok.com/embed/v2/${video.id}`;
      iframe.className = 'tiktok-player';
      // Note: TikTok embeds have their own controls

    } else if (video.platform === 'instagram') {
      // Instagram Reel embed
      iframe.src = video.embedUrl || `https://www.instagram.com/reel/${video.id}/embed`;
      iframe.className = 'instagram-player';
    }

    return iframe;
  }
  ```

- [ ] **Update player control methods** (lines ~418-440)
  ```javascript
  playVideo(index) {
    const slide = this.videoContainer.querySelector(`[data-video-id="${this.videos[index].id}"]`);
    if (!slide) return;

    const platform = slide.dataset.platform;
    const iframe = slide.querySelector('iframe');

    if (!iframe || !iframe.contentWindow) return;

    // Platform-specific play commands
    if (platform === 'youtube') {
      iframe.contentWindow.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        '*'
      );
    } else if (platform === 'tiktok') {
      // TikTok autoplays when visible, no explicit play needed
      // Could trigger via postMessage if TikTok API supports it
    } else if (platform === 'instagram') {
      // Instagram embed autoplays, no explicit control
    }
  }

  pauseVideo(index) {
    const slide = this.videoContainer.querySelector(`[data-video-id="${this.videos[index].id}"]`);
    if (!slide) return;

    const platform = slide.dataset.platform;
    const iframe = slide.querySelector('iframe');

    if (!iframe || !iframe.contentWindow) return;

    // Platform-specific pause commands
    if (platform === 'youtube') {
      iframe.contentWindow.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        '*'
      );
    }
    // TikTok and Instagram: pause when not visible (browser handles this)
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateMuteIcon();

    // Apply mute to current video
    const currentSlide = this.videoContainer.querySelector('.video-slide.active');
    if (!currentSlide) return;

    const platform = currentSlide.dataset.platform;
    const iframe = currentSlide.querySelector('iframe');

    if (!iframe || !iframe.contentWindow) return;

    if (platform === 'youtube') {
      const command = this.isMuted ? 'mute' : 'unMute';
      iframe.contentWindow.postMessage(
        `{"event":"command","func":"${command}","args":""}`,
        '*'
      );
    }
    // TikTok and Instagram mute handled by their own controls
  }
  ```

### CSS Updates

#### File: `public/style.css`

- [ ] **Add platform-specific iframe styles**
  ```css
  /* Platform-specific player adjustments */
  .video-slide iframe.youtube-player {
    width: 100%;
    height: 100%;
  }

  .video-slide iframe.tiktok-player {
    width: 100%;
    height: 100%;
    /* TikTok embeds may need aspect ratio adjustment */
  }

  .video-slide iframe.instagram-player {
    width: 100%;
    height: 100%;
    /* Instagram embeds may have fixed dimensions */
  }
  ```

- [ ] **Add platform indicator in video info**
  ```css
  .video-info .platform-indicator {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    opacity: 0.8;
  }

  .platform-indicator.youtube {
    background: #FF0000;
    color: white;
  }

  .platform-indicator.tiktok {
    background: #000000;
    color: #00F2EA;
  }
  ```

#### File: `public/index.html`

- [ ] **Add platform indicator to video info**
  ```html
  <div class="video-info">
    <div class="platform-indicator"></div>
    <div class="video-title"></div>
    <div class="channel-name"></div>
  </div>
  ```

- [ ] **Update renderVideoInfo method** (in app.js)
  ```javascript
  updateVideoInfo() {
    const video = this.videos[this.currentIndex];
    if (!video) return;

    const titleEl = document.querySelector('.video-title');
    const channelEl = document.querySelector('.channel-name');
    const platformEl = document.querySelector('.platform-indicator');

    if (titleEl) titleEl.textContent = video.title;
    if (channelEl) channelEl.textContent = video.sourceTitle || video.channelTitle;

    if (platformEl) {
      platformEl.textContent = video.platform.toUpperCase();
      platformEl.className = `platform-indicator ${video.platform}`;
    }
  }
  ```

---

## Phase 5: Testing & Refinement (Week 3-4)

### Functional Testing

- [ ] **Test YouTube integration still works**
  - [ ] Add YouTube channel
  - [ ] Videos load correctly
  - [ ] Playback works
  - [ ] Swipe gestures work
  - [ ] Mute/unmute works

- [ ] **Test TikTok integration**
  - [ ] Add TikTok user (@username)
  - [ ] Videos load from TikTok
  - [ ] TikTok embeds display correctly
  - [ ] Swipe gestures work with TikTok
  - [ ] Videos autoplay when swiped to
  - [ ] TikTok controls visible and functional

- [ ] **Test mixed feed (YouTube + TikTok)**
  - [ ] Videos from both platforms intermixed
  - [ ] Balanced distribution works
  - [ ] Smooth transitions between platforms
  - [ ] Watch history tracks both platforms
  - [ ] Filter unwatched works across platforms

- [ ] **Test edge cases**
  - [ ] Invalid TikTok username
  - [ ] TikTok user with no videos
  - [ ] TikTok user with private account
  - [ ] Network error handling
  - [ ] Empty feed (no sources added)
  - [ ] API rate limiting

### Mobile Testing

- [ ] **iOS Safari**
  - [ ] Video playback (YouTube & TikTok)
  - [ ] Swipe gestures
  - [ ] Autoplay behavior
  - [ ] Full-screen mode
  - [ ] PWA installation and launch

- [ ] **Android Chrome**
  - [ ] Video playback (YouTube & TikTok)
  - [ ] Swipe gestures
  - [ ] Autoplay behavior
  - [ ] Full-screen mode
  - [ ] PWA installation and launch

- [ ] **Desktop browsers**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

### Performance Testing

- [ ] **Load time measurements**
  - [ ] Initial page load
  - [ ] Video fetching time
  - [ ] First video playback time
  - [ ] Swipe transition smoothness

- [ ] **Memory usage**
  - [ ] Monitor with multiple sources
  - [ ] Check for memory leaks during long sessions
  - [ ] Verify only 3 iframes active at a time

- [ ] **API usage**
  - [ ] Monitor YouTube API quota usage
  - [ ] Track TikTok API calls (if using third-party)
  - [ ] Verify caching is working (check server logs)

### UI/UX Testing

- [ ] **Visual consistency**
  - [ ] Platform badges visible and clear
  - [ ] Source list displays correctly
  - [ ] Settings modal layout works
  - [ ] Video info displays for all platforms

- [ ] **User flow**
  - [ ] Easy to add TikTok users
  - [ ] Clear indication of platform per video
  - [ ] Settings changes take effect
  - [ ] History shows mixed platforms

---

## Phase 6: Instagram Reels (Optional - Week 5-6)

### Setup

- [ ] Complete Facebook Developer setup (see Pre-Implementation)
- [ ] Test OAuth flow in development
- [ ] Configure redirect URIs

### Backend Implementation

#### File: `server.js`

- [ ] **Add Instagram OAuth endpoints**
  ```javascript
  app.get('/api/instagram/oauth/authorize', (req, res) => {
    const csrfState = Math.random().toString(36).substring(2);
    res.cookie('csrfState', csrfState, { maxAge: 60000 });

    let url = 'https://api.instagram.com/oauth/authorize';
    url += `?client_id=${process.env.INSTAGRAM_APP_ID}`;
    url += '&redirect_uri=' + encodeURIComponent(process.env.INSTAGRAM_REDIRECT_URI);
    url += '&scope=user_profile,user_media';
    url += '&response_type=code';
    url += `&state=${csrfState}`;

    res.redirect(url);
  });

  app.get('/api/instagram/oauth/callback', async (req, res) => {
    const { code, state } = req.query;

    if (state !== req.cookies.csrfState) {
      return res.status(403).send('CSRF verification failed');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
          code: code
        })
      });

      const tokenData = await tokenResponse.json();

      // Return token to client
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'INSTAGRAM_AUTH_SUCCESS',
            accessToken: '${tokenData.access_token}',
            userId: '${tokenData.user_id}'
          }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('Instagram OAuth error:', error);
      res.status(500).send('Authentication failed');
    }
  });
  ```

- [ ] **Add Instagram Reels endpoint**
  ```javascript
  app.get('/api/instagram/user/media', async (req, res) => {
    try {
      const accessToken = req.query.access_token;
      const userId = req.query.user_id;

      if (!accessToken || !userId) {
        return res.status(401).json({ error: 'Access token and user ID required' });
      }

      // Fetch user's media
      const response = await fetch(
        `https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,media_product_type&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Filter for Reels only
      const reels = data.data
        .filter(item => item.media_product_type === 'REELS')
        .map(reel => ({
          id: reel.id,
          title: reel.caption || 'Instagram Reel',
          sourceTitle: 'Your Instagram',
          thumbnail: reel.thumbnail_url,
          embedUrl: reel.permalink + 'embed',
          publishedAt: reel.timestamp,
          duration: 0,
          platform: 'instagram'
        }));

      res.json({ videos: reels, platform: 'instagram' });
    } catch (error) {
      console.error('Instagram API error:', error);
      res.status(500).json({ error: 'Failed to fetch Instagram Reels', details: error.message });
    }
  });
  ```

### Frontend Implementation

#### File: `public/app.js`

- [ ] **Implement Instagram OAuth popup**
  ```javascript
  async connectInstagram() {
    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const popup = window.open(
      '/api/instagram/oauth/authorize',
      'Instagram Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth callback
    return new Promise((resolve, reject) => {
      window.addEventListener('message', function handler(event) {
        if (event.data.type === 'INSTAGRAM_AUTH_SUCCESS') {
          window.removeEventListener('message', handler);

          // Store tokens
          localStorage.setItem('instagram_access_token', event.data.accessToken);
          localStorage.setItem('instagram_user_id', event.data.userId);

          resolve(event.data);
        }
      });

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('Authorization cancelled'));
        }
      }, 1000);
    });
  }
  ```

- [ ] **Implement fetchInstagramReels**
  ```javascript
  async fetchInstagramReels(sourceId, maxResults = 20) {
    try {
      const accessToken = localStorage.getItem('instagram_access_token');
      const userId = localStorage.getItem('instagram_user_id');

      if (!accessToken || !userId) {
        console.log('Instagram not connected');
        return { videos: [] };
      }

      const response = await fetch(
        `/api/instagram/user/media?access_token=${accessToken}&user_id=${userId}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, need to re-authenticate
          localStorage.removeItem('instagram_access_token');
          localStorage.removeItem('instagram_user_id');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return { videos: data.videos.slice(0, maxResults) };
    } catch (error) {
      console.error('Error fetching Instagram Reels:', error);
      return { videos: [], error: error.message };
    }
  }
  ```

- [ ] **Add Instagram connect button in settings**
  ```html
  <div id="instagram-section">
    <h3>Instagram Reels</h3>
    <p>Connect your Instagram account to view your Reels</p>
    <button id="connect-instagram-btn" class="primary-btn">
      Connect Instagram
    </button>
    <div id="instagram-status" style="display:none">
      <p>✅ Connected</p>
      <button id="disconnect-instagram-btn">Disconnect</button>
    </div>
  </div>
  ```

---

## Phase 7: Documentation & Deployment (Week 4 or 7)

### Documentation Updates

- [ ] **Update README.md**
  - [ ] Add multi-platform features section
  - [ ] Document TikTok setup instructions
  - [ ] Document Instagram setup (if implemented)
  - [ ] Update architecture diagrams
  - [ ] Add troubleshooting for new platforms

- [ ] **Update DEPLOYMENT.md**
  - [ ] Add new environment variables
  - [ ] Document OAuth configuration
  - [ ] Update dependencies list

- [ ] **Create USER_GUIDE.md**
  - [ ] How to add TikTok users
  - [ ] How to connect Instagram (if implemented)
  - [ ] How to manage multi-platform sources
  - [ ] FAQs for new features

### Deployment Preparation

- [ ] **Environment variables**
  - [ ] Add all new keys to hosting platform
  - [ ] Configure OAuth redirect URIs
  - [ ] Test in staging environment

- [ ] **Database/Storage** (if added)
  - [ ] Set up token storage (if not using localStorage)
  - [ ] Configure session management
  - [ ] Test OAuth flow in production-like environment

- [ ] **Monitoring**
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Monitor API usage and costs
  - [ ] Set up alerts for API failures

### Deployment Steps

- [ ] **Staging deployment**
  - [ ] Deploy to staging environment
  - [ ] Test OAuth flows with production credentials
  - [ ] Verify all platforms work
  - [ ] Test on real mobile devices

- [ ] **Production deployment**
  - [ ] Deploy code to production
  - [ ] Monitor error rates
  - [ ] Check API usage
  - [ ] Verify PWA updates on mobile

- [ ] **Post-deployment**
  - [ ] Monitor user adoption
  - [ ] Collect user feedback
  - [ ] Track API costs
  - [ ] Monitor performance metrics

---

## Success Criteria

### Must Have (Before Release)

- [ ] TikTok users can be added successfully
- [ ] TikTok videos display and play in the app
- [ ] YouTube functionality remains unchanged
- [ ] Mixed feeds work correctly
- [ ] Swipe gestures work on all platforms
- [ ] Mobile experience is smooth (iOS & Android)
- [ ] No significant performance degradation
- [ ] Watch history tracks all platforms

### Nice to Have (Can be added later)

- [ ] Instagram Reels integration
- [ ] Platform filtering (show only YouTube, only TikTok, etc.)
- [ ] Platform-specific statistics
- [ ] Import/export settings with multi-platform data
- [ ] Keyboard shortcuts for desktop
- [ ] Advanced search/discovery features

---

## Rollback Plan

If issues arise, here's the rollback strategy:

### Code Rollback
- [ ] Git tag stable pre-multi-platform version
- [ ] Document rollback procedure
- [ ] Test rollback in staging

### Data Migration Rollback
- [ ] Keep backup of old localStorage schema
- [ ] Implement reverse migration function
- [ ] Test data integrity after rollback

### Partial Rollback
- [ ] Feature flag system to disable TikTok/Instagram
- [ ] Allow disabling new platforms without full code rollback
- [ ] Gracefully handle missing platform APIs

---

## Notes & Tips

### Development Tips
- Test with real accounts (create test TikTok/Instagram accounts)
- Use browser DevTools Network tab to debug API calls
- Check browser console for iframe errors
- Test with browser cache disabled to catch caching issues

### Common Issues & Solutions
- **TikTok embeds not loading**: Check CSP headers, verify embed URL format
- **OAuth popup blocked**: Ensure triggered by user click, not automatic
- **Swipe not working**: Verify `pointer-events: none` on iframes
- **Videos not playing**: Check autoplay policies, ensure mute on mobile

### Performance Optimization
- Lazy-load TikTok embed.js script
- Cache oEmbed responses aggressively
- Consider CDN for static assets
- Monitor bundle size (shouldn't increase significantly)

---

**Last Updated**: January 13, 2026
**Version**: 1.0
