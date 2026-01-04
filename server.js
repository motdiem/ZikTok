require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const UPDATE_TOKEN = process.env.UPDATE_TOKEN;

// Simple in-memory cache to reduce API calls
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Serve static files from 'public' directory
app.use(express.static('public'));

// API endpoint to get channel's shorts
app.get('/api/channel/:channelId/shorts', async (req, res) => {
  try {
    const { channelId } = req.params;
    const cacheKey = `channel_${channelId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Cache hit for channel: ${channelId}`);
      return res.json(cached.data);
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    console.log(`Fetching shorts for channel: ${channelId}`);

    // Step 1: Get channel's uploads playlist ID and info
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelResponse.json();

    // Check for YouTube API errors
    if (channelData.error) {
      console.error('YouTube API error:', channelData.error);
      return res.status(500).json({
        error: 'YouTube API error',
        details: channelData.error.message,
        reason: channelData.error.errors?.[0]?.reason
      });
    }

    if (!channelData.items || channelData.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Step 2: Get recent videos from uploads playlist (max 50)
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
    );
    const playlistData = await playlistResponse.json();

    // Check for YouTube API errors
    if (playlistData.error) {
      console.error('YouTube API error (playlist):', playlistData.error);
      return res.status(500).json({
        error: 'YouTube API error',
        details: playlistData.error.message,
        reason: playlistData.error.errors?.[0]?.reason
      });
    }

    if (!playlistData.items) {
      return res.json({ shorts: [] });
    }

    const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');

    // Step 3: Get video details to filter for shorts (duration < 60s)
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    const videosData = await videosResponse.json();

    // Check for YouTube API errors
    if (videosData.error) {
      console.error('YouTube API error (videos):', videosData.error);
      return res.status(500).json({
        error: 'YouTube API error',
        details: videosData.error.message,
        reason: videosData.error.errors?.[0]?.reason
      });
    }

    // Filter for shorts (videos under 60 seconds)
    const shorts = videosData.items.filter(video => {
      const duration = parseDuration(video.contentDetails.duration);
      return duration <= 60;
    }).map(video => ({
      id: video.id,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      thumbnail: video.snippet.thumbnails.high.url,
      description: video.snippet.description
    }));

    const result = { shorts, channelId, channelTitle: channelData.items[0].snippet.title };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    res.json(result);
  } catch (error) {
    console.error('Error fetching shorts:', error);
    res.status(500).json({ error: 'Failed to fetch shorts', message: error.message });
  }
});

// API endpoint to get channel ID from username or handle
app.get('/api/channel/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    // Try to search for the channel
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=5&key=${YOUTUBE_API_KEY}`
    );
    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channels = searchData.items.map(item => ({
      id: item.snippet.channelId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
      description: item.snippet.description
    }));

    res.json({ channels });
  } catch (error) {
    console.error('Error searching channels:', error);
    res.status(500).json({ error: 'Failed to search channels', message: error.message });
  }
});

// Update endpoint - pulls latest code from git and restarts the server
app.get('/update', async (req, res) => {
  try {
    // Verify authentication token
    const { token } = req.query;

    if (!UPDATE_TOKEN) {
      return res.status(500).json({
        error: 'Update endpoint not configured',
        message: 'UPDATE_TOKEN environment variable is not set'
      });
    }

    if (token !== UPDATE_TOKEN) {
      console.warn('⚠️  Unauthorized update attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🔄 Update requested - pulling latest code...');

    // Execute git pull
    const { stdout, stderr } = await execAsync('git pull', { cwd: '/app' });

    console.log('Git pull output:', stdout);
    if (stderr) console.log('Git pull stderr:', stderr);

    // Check if there were any updates
    const isUpToDate = stdout.includes('Already up to date') || stdout.includes('Already up-to-date');

    if (isUpToDate) {
      return res.json({
        success: true,
        message: 'Already up to date',
        output: stdout
      });
    }

    // Send success response before restarting
    res.json({
      success: true,
      message: 'Code updated successfully. Server restarting...',
      output: stdout
    });

    // Give the response time to be sent, then restart
    setTimeout(() => {
      console.log('🔄 Restarting server to apply updates...');
      process.exit(0); // Docker will restart the container
    }, 500);

  } catch (error) {
    console.error('Error updating:', error);
    res.status(500).json({
      error: 'Update failed',
      message: error.message,
      details: error.stderr || error.stdout
    });
  }
});

// Helper function to parse ISO 8601 duration to seconds
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = (match[1] || '').replace('H', '') || 0;
  const minutes = (match[2] || '').replace('M', '') || 0;
  const seconds = (match[3] || '').replace('S', '') || 0;
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

app.listen(PORT, () => {
  console.log(`ZikTok server running on http://localhost:${PORT}`);
  console.log(`YouTube API Key configured: ${YOUTUBE_API_KEY ? 'Yes' : 'No'}`);
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️  Warning: YouTube API key not found. Please set YOUTUBE_API_KEY in .env file');
  }
});
