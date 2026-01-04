// ZikTok - YouTube Shorts PWA
// Main Application Logic

class ZikTok {
  constructor() {
    // State
    this.videos = [];
    this.currentIndex = 0;
    this.channels = this.loadChannels();
    this.sortMode = 'date'; // 'date' or 'random'
    // Auto-mute on mobile for better autoplay compatibility
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    this.isMuted = isMobile;
    this.players = {}; // YouTube player instances
    this.isLoadingVideos = false;
    this.currentVideoPlaying = true; // Track play state

    // Touch handling
    this.touchStartY = 0;
    this.touchEndY = 0;
    this.isDragging = false;
    this.dragDistance = 0;

    // Video navigation tracking (for swipe hint)
    this.videoChanges = 0;

    // DOM Elements
    this.videoContainer = document.getElementById('video-container');
    this.loadingScreen = document.getElementById('loading-screen');
    this.settingsModal = document.getElementById('settings-modal');
    this.swipeHint = document.getElementById('swipe-hint');

    // Initialize
    this.init();
  }

  async init() {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load default channels if none exist
    if (this.channels.length === 0) {
      // First run - show settings modal
      this.hideLoading();
      this.openSettings();
      return; // Don't try to load videos yet
    }

    // Load videos
    await this.loadAllVideos();

    // Hide loading screen
    this.hideLoading();

    // Update mute button to reflect initial state (mobile starts muted)
    this.updateMuteIcon();

    // Show swipe hint for first-time users
    this.showSwipeHint();
  }

  setupEventListeners() {
    // Sort buttons
    document.getElementById('sort-date').addEventListener('click', () => this.setSortMode('date'));
    document.getElementById('sort-random').addEventListener('click', () => this.setSortMode('random'));

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
    document.getElementById('close-modal').addEventListener('click', () => this.closeSettings());

    // Channel search
    document.getElementById('search-channel-btn').addEventListener('click', () => this.searchChannels());
    document.getElementById('channel-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchChannels();
    });

    // Import/Export
    document.getElementById('export-settings-btn').addEventListener('click', () => this.exportSettings());
    document.getElementById('import-settings-btn').addEventListener('click', () => this.importSettings());

    // Video controls
    document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());
    document.getElementById('share-btn').addEventListener('click', () => this.shareVideo());

    // Touch events for swipe navigation
    this.videoContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    this.videoContainer.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.videoContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

    // Keyboard navigation (for desktop)
    document.addEventListener('keydown', (e) => {
      // Don't intercept if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent page scrolling
      }

      if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') this.previousVideo();
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') this.nextVideo();
      if (e.key === 'ArrowLeft') this.previousVideo();
      if (e.key === 'ArrowRight') this.nextVideo();
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
      if (e.key === ' ') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });

    // Close modal on outside click
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.closeSettings();
    });
  }

  // ===== Video Loading =====

  async loadAllVideos() {
    if (this.isLoadingVideos) return;
    this.isLoadingVideos = true;

    this.showLoading();
    this.videos = [];

    try {
      // Calculate balanced videos per channel (aiming for ~100 total)
      const targetTotal = 100;
      const videosPerChannel = Math.max(Math.floor(targetTotal / this.channels.length), 10);

      console.log(`Fetching ${videosPerChannel} videos from each of ${this.channels.length} channels (target: ~${targetTotal} total)`);

      const promises = this.channels.map(channel => this.fetchChannelShorts(channel.id, videosPerChannel));
      const results = await Promise.all(promises);

      results.forEach(result => {
        if (result && result.shorts) {
          this.videos.push(...result.shorts);
        }
      });

      console.log(`Loaded ${this.videos.length} total shorts from ${this.channels.length} channels`);

      if (this.videos.length === 0) {
        alert('No shorts found. Please add channels in settings.');
        this.openSettings();
        return;
      }

      // Sort videos
      this.applySortMode();

      // Create video slides
      this.createVideoSlides();

    } catch (error) {
      console.error('Error loading videos:', error);
      alert('Failed to load videos. Please check your connection and try again.');
    } finally {
      this.isLoadingVideos = false;
      this.hideLoading();
    }
  }

  async fetchChannelShorts(channelId, maxResults = 50) {
    try {
      const response = await fetch(`/api/channel/${channelId}/shorts?maxResults=${maxResults}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.details || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Failed to fetch shorts for channel ${channelId}: ${errorMsg}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching channel ${channelId}:`, error);
      return null;
    }
  }

  applySortMode() {
    if (this.sortMode === 'date') {
      // Sort by publish date (newest first)
      this.videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } else if (this.sortMode === 'random') {
      // Fisher-Yates shuffle
      for (let i = this.videos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.videos[i], this.videos[j]] = [this.videos[j], this.videos[i]];
      }
    }
  }

  setSortMode(mode) {
    if (this.sortMode === mode) return;

    this.sortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sort-${mode}`).classList.add('active');

    this.applySortMode();
    this.currentIndex = 0;
    this.createVideoSlides();
  }

  // ===== Video Slide Management =====

  createVideoSlides() {
    // Clear existing slides
    this.videoContainer.innerHTML = '';
    this.players = {};

    if (this.videos.length === 0) return;

    // Create slides for current, previous, and next video
    const indices = [
      this.currentIndex - 1,
      this.currentIndex,
      this.currentIndex + 1
    ];

    indices.forEach((index, position) => {
      if (index >= 0 && index < this.videos.length) {
        this.createVideoSlide(index, position);
      }
    });

    // Update video info
    this.updateVideoInfo();

    // Play current video
    this.playCurrentVideo();
  }

  createVideoSlide(videoIndex, position) {
    const video = this.videos[videoIndex];
    const slide = document.createElement('div');
    slide.className = 'video-slide';
    slide.dataset.index = videoIndex;

    // Position classes: 0 = prev, 1 = active, 2 = next
    if (position === 0) slide.classList.add('prev');
    else if (position === 1) slide.classList.add('active');
    else if (position === 2) slide.classList.add('next');

    // Create YouTube iframe
    const iframe = document.createElement('iframe');
    const videoId = video.id;
    // Always mute on mobile to allow autoplay, user can unmute with button
    const shouldMute = this.isMuted || this.isMobileDevice() ? 1 : 0;
    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${shouldMute}&controls=0&modestbranding=1&rel=0&cc_load_policy=1&playsinline=1&loop=1&playlist=${videoId}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('playsinline', '');
    iframe.id = `player-${videoIndex}`;

    // Add tap to play for mobile Safari
    slide.addEventListener('click', () => {
      if (parseInt(slide.dataset.index) === this.currentIndex) {
        this.playVideo(this.currentIndex);
      }
    });

    slide.appendChild(iframe);
    this.videoContainer.appendChild(slide);

    // Initialize YouTube Player API
    this.initializePlayer(videoIndex, videoId);
  }

  initializePlayer(index, videoId) {
    // The YouTube IFrame Player API will be loaded via the YouTube embed
    // We'll use postMessage to control the player
    const iframe = document.getElementById(`player-${index}`);
    if (iframe) {
      this.players[index] = iframe;
    }
  }

  // ===== Navigation =====

  nextVideo() {
    if (this.currentIndex >= this.videos.length - 1) {
      return; // Last video
    }

    this.currentIndex++;
    this.videoChanges++;
    this.updateSlides('next');
    this.updateVideoInfo();
    this.playCurrentVideo();
    this.checkHideSwipeHint();
  }

  previousVideo() {
    if (this.currentIndex <= 0) {
      return; // First video
    }

    this.currentIndex--;
    this.videoChanges++;
    this.updateSlides('prev');
    this.updateVideoInfo();
    this.playCurrentVideo();
    this.checkHideSwipeHint();
  }

  updateSlides(direction) {
    // Remove old slides
    const slides = Array.from(this.videoContainer.querySelectorAll('.video-slide'));
    slides.forEach(slide => {
      const index = parseInt(slide.dataset.index);
      if (Math.abs(index - this.currentIndex) > 1) {
        slide.remove();
        delete this.players[index];
      }
    });

    // Update existing slide positions
    slides.forEach(slide => {
      const index = parseInt(slide.dataset.index);
      slide.classList.remove('prev', 'active', 'next');

      if (index === this.currentIndex - 1) slide.classList.add('prev');
      else if (index === this.currentIndex) slide.classList.add('active');
      else if (index === this.currentIndex + 1) slide.classList.add('next');
    });

    // Add new slide if needed
    if (direction === 'next' && this.currentIndex + 1 < this.videos.length) {
      const nextIndex = this.currentIndex + 1;
      if (!document.querySelector(`[data-index="${nextIndex}"]`)) {
        this.createVideoSlide(nextIndex, 2);
      }
    } else if (direction === 'prev' && this.currentIndex - 1 >= 0) {
      const prevIndex = this.currentIndex - 1;
      if (!document.querySelector(`[data-index="${prevIndex}"]`)) {
        this.createVideoSlide(prevIndex, 0);
      }
    }
  }

  updateVideoInfo() {
    const video = this.videos[this.currentIndex];
    if (video) {
      document.getElementById('video-title').textContent = video.title;
      document.getElementById('video-channel').textContent = video.channelTitle;
    }
  }

  playCurrentVideo() {
    // Pause all other videos
    Object.keys(this.players).forEach(index => {
      if (parseInt(index) !== this.currentIndex) {
        this.pauseVideo(index);
      }
    });

    // Play current video
    this.playVideo(this.currentIndex);
    this.currentVideoPlaying = true;
  }

  playVideo(index) {
    const iframe = this.players[index];
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
  }

  pauseVideo(index) {
    const iframe = this.players[index];
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }
  }

  togglePlayPause() {
    if (!this.currentVideoPlaying) {
      this.playVideo(this.currentIndex);
      this.currentVideoPlaying = true;
    } else {
      this.pauseVideo(this.currentIndex);
      this.currentVideoPlaying = false;
    }
  }

  // ===== Touch Handling =====

  handleTouchStart(e) {
    this.touchStartY = e.touches[0].clientY;
    this.isDragging = true;
    this.dragDistance = 0;
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;

    this.touchEndY = e.touches[0].clientY;
    this.dragDistance = this.touchStartY - this.touchEndY;

    // Visual feedback for drag
    const activeSlide = this.videoContainer.querySelector('.video-slide.active');
    if (activeSlide && Math.abs(this.dragDistance) > 10) {
      e.preventDefault(); // Prevent scrolling
      const translateY = -this.dragDistance;
      activeSlide.style.transform = `translateY(${translateY}px)`;
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const activeSlide = this.videoContainer.querySelector('.video-slide.active');
    if (activeSlide) {
      activeSlide.style.transform = '';
    }

    // Threshold for swipe (50px)
    if (this.dragDistance > 50) {
      // Swiped up - next video
      this.nextVideo();
      this.hideSwipeHint();
    } else if (this.dragDistance < -50) {
      // Swiped down - previous video
      this.previousVideo();
      this.hideSwipeHint();
    }

    this.dragDistance = 0;
  }

  // ===== Controls =====

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateMuteIcon();

    // Update all iframes
    Object.keys(this.players).forEach(index => {
      const iframe = this.players[index];
      if (iframe && iframe.contentWindow) {
        const func = this.isMuted ? 'mute' : 'unMute';
        iframe.contentWindow.postMessage(`{"event":"command","func":"${func}","args":""}`, '*');
      }
    });
  }

  updateMuteIcon() {
    const icon = document.getElementById('volume-icon');
    if (!icon) return;

    if (this.isMuted) {
      icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else {
      icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    }
  }

  async shareVideo() {
    const video = this.videos[this.currentIndex];
    if (!video) return;

    const shareData = {
      title: video.title,
      text: `Check out this video: ${video.title}`,
      url: `https://youtube.com/shorts/${video.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  // ===== Settings =====

  openSettings() {
    this.settingsModal.classList.add('show');
    this.renderChannelList();
    this.pauseVideo(this.currentIndex);
  }

  closeSettings() {
    this.settingsModal.classList.remove('show');
    this.playCurrentVideo();
  }

  renderChannelList() {
    const channelList = document.getElementById('channel-list');
    channelList.innerHTML = '';

    if (this.channels.length === 0) {
      channelList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No channels added yet</p>';
      return;
    }

    this.channels.forEach(channel => {
      const item = this.createChannelItem(channel, true);
      channelList.appendChild(item);
    });
  }

  async searchChannels() {
    const query = document.getElementById('channel-search-input').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Searching...</p>';

    try {
      const response = await fetch(`/api/channel/search/${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!data.channels || data.channels.length === 0) {
        resultsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5);">No channels found</p>';
        return;
      }

      resultsContainer.innerHTML = '';
      data.channels.forEach(channel => {
        const isAdded = this.channels.some(c => c.id === channel.id);
        if (!isAdded) {
          const item = this.createChannelItem(channel, false);
          resultsContainer.appendChild(item);
        }
      });

    } catch (error) {
      console.error('Error searching channels:', error);
      resultsContainer.innerHTML = '<p style="color: rgba(255,100,100,0.8);">Error searching channels</p>';
    }
  }

  createChannelItem(channel, isAdded) {
    const item = document.createElement('div');
    item.className = 'channel-item';

    const thumbnail = channel.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%23333" width="40" height="40"/%3E%3C/svg%3E';

    item.innerHTML = `
      <img src="${thumbnail}" alt="${channel.title}">
      <div class="channel-item-info">
        <h4>${channel.title}</h4>
        <p>${channel.description || 'YouTube Channel'}</p>
      </div>
      <button class="${isAdded ? 'remove-btn' : 'add-btn'}">
        ${isAdded ? 'Remove' : 'Add'}
      </button>
    `;

    const button = item.querySelector('button');
    button.addEventListener('click', () => {
      if (isAdded) {
        this.removeChannel(channel.id);
      } else {
        this.addChannel(channel);
      }
    });

    return item;
  }

  addChannel(channel) {
    if (this.channels.some(c => c.id === channel.id)) return;

    this.channels.push({
      id: channel.id,
      title: channel.title,
      thumbnail: channel.thumbnail
    });

    this.saveChannels();
    this.renderChannelList();
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('channel-search-input').value = '';

    // Reload videos
    this.loadAllVideos();
  }

  removeChannel(channelId) {
    this.channels = this.channels.filter(c => c.id !== channelId);
    this.saveChannels();
    this.renderChannelList();

    // Reload videos if channels still exist
    if (this.channels.length > 0) {
      this.loadAllVideos();
    }
  }

  // ===== Storage =====

  loadChannels() {
    try {
      const stored = localStorage.getItem('ziktok_channels');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading channels:', error);
      return [];
    }
  }

  saveChannels() {
    try {
      localStorage.setItem('ziktok_channels', JSON.stringify(this.channels));
    } catch (error) {
      console.error('Error saving channels:', error);
    }
  }

  // ===== UI Helpers =====

  showLoading() {
    this.loadingScreen.classList.remove('hidden');
  }

  hideLoading() {
    this.loadingScreen.classList.add('hidden');
  }

  showSwipeHint() {
    const hasSeenHint = localStorage.getItem('ziktok_seen_hint');
    if (!hasSeenHint) {
      this.swipeHint.classList.remove('hidden');
      setTimeout(() => {
        this.hideSwipeHint();
      }, 5000);
    }
  }

  hideSwipeHint() {
    this.swipeHint.classList.add('hidden');
    localStorage.setItem('ziktok_seen_hint', 'true');
  }

  checkHideSwipeHint() {
    // Hide hint after 2 video changes (showing the second video)
    if (this.videoChanges >= 2) {
      this.hideSwipeHint();
    }
  }

  // ===== Utilities =====

  isMobileDevice() {
    // Detect mobile devices (iOS, Android, etc.)
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  // ===== Import/Export Settings =====

  exportSettings() {
    const settings = {
      channels: this.channels,
      sortMode: this.sortMode,
      isMuted: this.isMuted,
      version: '1.0'
    };

    const json = JSON.stringify(settings, null, 2);
    const textarea = document.getElementById('settings-json');
    textarea.value = json;
    textarea.select();

    // Try to copy to clipboard
    try {
      document.execCommand('copy');
      alert('Settings exported and copied to clipboard!');
    } catch (err) {
      alert('Settings exported! Copy the JSON from the textarea.');
    }
  }

  importSettings() {
    const textarea = document.getElementById('settings-json');
    const json = textarea.value.trim();

    if (!json) {
      alert('Please paste your settings JSON in the textarea first.');
      return;
    }

    try {
      const settings = JSON.parse(json);

      // Validate settings
      if (!settings.channels || !Array.isArray(settings.channels)) {
        throw new Error('Invalid settings format: missing or invalid channels array');
      }

      // Import channels
      this.channels = settings.channels;
      this.saveChannels();

      // Import other settings
      if (settings.sortMode) {
        this.sortMode = settings.sortMode;
      }
      if (typeof settings.isMuted === 'boolean') {
        this.isMuted = settings.isMuted;
      }

      // Update UI
      this.renderChannelList();
      textarea.value = '';

      alert(`Successfully imported ${this.channels.length} channel(s)!`);

      // Reload videos if we're not on first run
      if (this.channels.length > 0) {
        this.closeSettings();
        this.loadAllVideos();
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import settings. Please check the JSON format.\n\nError: ' + error.message);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ZikTok());
} else {
  new ZikTok();
}
