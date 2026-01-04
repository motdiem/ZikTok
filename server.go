package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"sync"
	"time"
)

// Cache structure with TTL support
type CacheItem struct {
	Data      interface{}
	Timestamp time.Time
}

type Cache struct {
	items map[string]CacheItem
	mu    sync.RWMutex
}

func NewCache() *Cache {
	return &Cache{
		items: make(map[string]CacheItem),
	}
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, exists := c.items[key]
	if !exists {
		return nil, false
	}

	// Check if cache is expired (1 hour TTL)
	if time.Since(item.Timestamp) > time.Hour {
		return nil, false
	}

	return item.Data, true
}

func (c *Cache) Set(key string, data interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[key] = CacheItem{
		Data:      data,
		Timestamp: time.Now(),
	}
}

// YouTube API response structures
type ChannelResponse struct {
	Items []struct {
		ContentDetails struct {
			RelatedPlaylists struct {
				Uploads string `json:"uploads"`
			} `json:"relatedPlaylists"`
		} `json:"contentDetails"`
		Snippet struct {
			Title string `json:"title"`
		} `json:"snippet"`
	} `json:"items"`
	Error *APIError `json:"error,omitempty"`
}

type PlaylistResponse struct {
	Items []struct {
		Snippet struct {
			ResourceID struct {
				VideoID string `json:"videoId"`
			} `json:"resourceId"`
		} `json:"snippet"`
	} `json:"items"`
	Error *APIError `json:"error,omitempty"`
}

type VideosResponse struct {
	Items []struct {
		ID      string `json:"id"`
		Snippet struct {
			Title        string `json:"title"`
			ChannelTitle string `json:"channelTitle"`
			PublishedAt  string `json:"publishedAt"`
			Thumbnails   struct {
				High struct {
					URL string `json:"url"`
				} `json:"high"`
			} `json:"thumbnails"`
			Description string `json:"description"`
		} `json:"snippet"`
		ContentDetails struct {
			Duration string `json:"duration"`
		} `json:"contentDetails"`
	} `json:"items"`
	Error *APIError `json:"error,omitempty"`
}

type SearchResponse struct {
	Items []struct {
		Snippet struct {
			ChannelID   string `json:"channelId"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Thumbnails  struct {
				Default struct {
					URL string `json:"url"`
				} `json:"default"`
			} `json:"thumbnails"`
		} `json:"snippet"`
	} `json:"items"`
	Error *APIError `json:"error,omitempty"`
}

type APIError struct {
	Message string `json:"message"`
	Errors  []struct {
		Reason string `json:"reason"`
	} `json:"errors"`
}

type VideoShort struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	ChannelTitle string `json:"channelTitle"`
	PublishedAt  string `json:"publishedAt"`
	Thumbnail    string `json:"thumbnail"`
	Description  string `json:"description"`
}

type ShortsResponse struct {
	Shorts       []VideoShort `json:"shorts"`
	ChannelID    string       `json:"channelId"`
	ChannelTitle string       `json:"channelTitle"`
}

type ChannelInfo struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Thumbnail   string `json:"thumbnail"`
	Description string `json:"description"`
}

type SearchResult struct {
	Channels []ChannelInfo `json:"channels"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

var (
	cache         *Cache
	youtubeAPIKey string
)

func main() {
	// Load environment variables
	youtubeAPIKey = os.Getenv("YOUTUBE_API_KEY")
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// Initialize cache
	cache = NewCache()

	// Setup routes
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("/api/channel/{channelId}/shorts", getShortsHandler)
	mux.HandleFunc("/api/channel/search/{query}", searchChannelsHandler)

	// Static file serving
	fs := http.FileServer(http.Dir("public"))
	mux.Handle("/", fs)

	// Start server
	log.Printf("ZikTok server running on http://localhost:%s\n", port)
	log.Printf("YouTube API Key configured: %v\n", youtubeAPIKey != "")
	if youtubeAPIKey == "" {
		log.Println("⚠️  Warning: YouTube API key not found. Please set YOUTUBE_API_KEY environment variable")
	}

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func getShortsHandler(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("channelId")
	cacheKey := "channel_" + channelID

	// Check cache first
	if cached, ok := cache.Get(cacheKey); ok {
		log.Printf("Cache hit for channel: %s\n", channelID)
		respondJSON(w, http.StatusOK, cached)
		return
	}

	if youtubeAPIKey == "" {
		respondError(w, http.StatusInternalServerError, "YouTube API key not configured", "", "")
		return
	}

	log.Printf("Fetching shorts for channel: %s\n", channelID)

	// Step 1: Get channel's uploads playlist ID and info
	channelURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=%s&key=%s",
		channelID, youtubeAPIKey,
	)

	var channelData ChannelResponse
	if err := fetchJSON(channelURL, &channelData); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch channel data", err.Error(), "")
		return
	}

	if channelData.Error != nil {
		respondError(w, http.StatusInternalServerError, "YouTube API error", channelData.Error.Message, getErrorReason(channelData.Error))
		return
	}

	if len(channelData.Items) == 0 {
		respondError(w, http.StatusNotFound, "Channel not found", "", "")
		return
	}

	uploadsPlaylistID := channelData.Items[0].ContentDetails.RelatedPlaylists.Uploads
	channelTitle := channelData.Items[0].Snippet.Title

	// Step 2: Get recent videos from uploads playlist (max 50)
	playlistURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=%s&maxResults=50&key=%s",
		uploadsPlaylistID, youtubeAPIKey,
	)

	var playlistData PlaylistResponse
	if err := fetchJSON(playlistURL, &playlistData); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch playlist data", err.Error(), "")
		return
	}

	if playlistData.Error != nil {
		respondError(w, http.StatusInternalServerError, "YouTube API error (playlist)", playlistData.Error.Message, getErrorReason(playlistData.Error))
		return
	}

	if len(playlistData.Items) == 0 {
		result := ShortsResponse{
			Shorts:       []VideoShort{},
			ChannelID:    channelID,
			ChannelTitle: channelTitle,
		}
		respondJSON(w, http.StatusOK, result)
		return
	}

	// Collect video IDs
	videoIDs := make([]string, 0, len(playlistData.Items))
	for _, item := range playlistData.Items {
		videoIDs = append(videoIDs, item.Snippet.ResourceID.VideoID)
	}

	// Join video IDs with commas
	videoIDsStr := ""
	for i, id := range videoIDs {
		if i > 0 {
			videoIDsStr += ","
		}
		videoIDsStr += id
	}

	// Step 3: Get video details to filter for shorts (duration < 60s)
	videosURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=%s&key=%s",
		videoIDsStr, youtubeAPIKey,
	)

	var videosData VideosResponse
	if err := fetchJSON(videosURL, &videosData); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch videos data", err.Error(), "")
		return
	}

	if videosData.Error != nil {
		respondError(w, http.StatusInternalServerError, "YouTube API error (videos)", videosData.Error.Message, getErrorReason(videosData.Error))
		return
	}

	// Filter for shorts (videos under 60 seconds)
	shorts := make([]VideoShort, 0)
	for _, video := range videosData.Items {
		duration := parseDuration(video.ContentDetails.Duration)
		if duration <= 60 {
			shorts = append(shorts, VideoShort{
				ID:           video.ID,
				Title:        video.Snippet.Title,
				ChannelTitle: video.Snippet.ChannelTitle,
				PublishedAt:  video.Snippet.PublishedAt,
				Thumbnail:    video.Snippet.Thumbnails.High.URL,
				Description:  video.Snippet.Description,
			})
		}
	}

	result := ShortsResponse{
		Shorts:       shorts,
		ChannelID:    channelID,
		ChannelTitle: channelTitle,
	}

	// Cache the result
	cache.Set(cacheKey, result)

	respondJSON(w, http.StatusOK, result)
}

func searchChannelsHandler(w http.ResponseWriter, r *http.Request) {
	query := r.PathValue("query")

	if youtubeAPIKey == "" {
		respondError(w, http.StatusInternalServerError, "YouTube API key not configured", "", "")
		return
	}

	// Search for channels
	searchURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?part=snippet&q=%s&type=channel&maxResults=5&key=%s",
		url.QueryEscape(query), youtubeAPIKey,
	)

	var searchData SearchResponse
	if err := fetchJSON(searchURL, &searchData); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to search channels", err.Error(), "")
		return
	}

	if len(searchData.Items) == 0 {
		respondError(w, http.StatusNotFound, "Channel not found", "", "")
		return
	}

	channels := make([]ChannelInfo, 0, len(searchData.Items))
	for _, item := range searchData.Items {
		channels = append(channels, ChannelInfo{
			ID:          item.Snippet.ChannelID,
			Title:       item.Snippet.Title,
			Thumbnail:   item.Snippet.Thumbnails.Default.URL,
			Description: item.Snippet.Description,
		})
	}

	result := SearchResult{Channels: channels}
	respondJSON(w, http.StatusOK, result)
}

// Helper function to parse ISO 8601 duration to seconds
func parseDuration(duration string) int {
	// Pattern: PT1H2M3S or PT2M3S or PT3S
	re := regexp.MustCompile(`PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?`)
	matches := re.FindStringSubmatch(duration)

	if matches == nil {
		return 0
	}

	hours := parseIntOrZero(matches[1])
	minutes := parseIntOrZero(matches[2])
	seconds := parseIntOrZero(matches[3])

	return hours*3600 + minutes*60 + seconds
}

func parseIntOrZero(s string) int {
	if s == "" {
		return 0
	}
	val, _ := strconv.Atoi(s)
	return val
}

// Helper function to fetch and decode JSON
func fetchJSON(url string, target interface{}) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return json.NewDecoder(resp.Body).Decode(target)
}

// Helper function to send JSON response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Helper function to send error response
func respondError(w http.ResponseWriter, status int, error, details, reason string) {
	log.Printf("Error: %s - %s (reason: %s)\n", error, details, reason)
	respondJSON(w, status, ErrorResponse{
		Error:   error,
		Details: details,
		Reason:  reason,
	})
}

// Helper function to extract error reason
func getErrorReason(apiError *APIError) string {
	if apiError != nil && len(apiError.Errors) > 0 {
		return apiError.Errors[0].Reason
	}
	return ""
}
