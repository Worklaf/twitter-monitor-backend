// server.js - TWITTER API V2
const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(cors());
app.use(express.json());

// Twitter API credentials (добавь в Railway Environment Variables)
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY || 'YOUR_API_KEY',
  appSecret: process.env.TWITTER_API_SECRET || 'YOUR_API_SECRET',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
  accessSecret: process.env.TWITTER_ACCESS_SECRET || 'YOUR_ACCESS_SECRET',
});

// Read-only client
const readOnlyClient = client.readOnly;

// Endpoint для получения твитов пользователя
app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`📡 Fetching tweets for: ${username}`);
    
    // Получаем пользователя по username
    const user = await readOnlyClient.v2.userByUsername(username, {
      'user.fields': ['description', 'public_metrics', 'profile_image_url']
    });
    
    if (!user.data) {
      return res.status(404).json({ 
        error: 'User not found',
        username: username
      });
    }
    
    const userId = user.data.id;
    
    // Получаем твиты пользователя
    const tweets = await readOnlyClient.v2.userTimeline(userId, {
      max_results: Math.min(limit, 100),
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['attachments.media_keys']
    });
    
    // Форматируем результат
    const formattedTweets = tweets.data.data.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      likes: tweet.public_metrics.like_count,
      retweets: tweet.public_metrics.retweet_count,
      replies: tweet.public_metrics.reply_count,
      views: tweet.public_metrics.impression_count,
      url: `https://twitter.com/${username}/status/${tweet.id}`,
      entities: tweet.entities || {}
    }));
    
    res.json({
      success: true,
      user: {
        id: user.data.id,
        username: user.data.username,
        name: user.data.name,
        bio: user.data.description,
        followers: user.data.public_metrics.followers_count,
        following: user.data.public_metrics.following_count,
        tweets_count: user.data.public_metrics.tweet_count,
        profile_image: user.data.profile_image_url
      },
      tweets: formattedTweets,
      count: formattedTweets.length
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Обработка ошибок Twitter API
    if (error.code === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Try again later.'
      });
    }
    
    if (error.code === 401) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Check your Twitter API credentials'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to fetch tweets',
      code: error.code
    });
  }
});

// Поиск по твитам
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    console.log(`🔍 Searching for: ${query}`);
    
    const searchResults = await readOnlyClient.v2.search(query, {
      max_results: Math.min(limit, 100),
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      expansions: ['author_id']
    });
    
    const tweets = searchResults.data.data.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      likes: tweet.public_metrics.like_count,
      retweets: tweet.public_metrics.retweet_count,
      url: `https://twitter.com/i/status/${tweet.id}`
    }));
    
    res.json({
      success: true,
      query: query,
      tweets: tweets,
      count: tweets.length
    });
    
  } catch (error) {
    console.error('❌ Search Error:', error);
    res.status(500).json({ 
      error: error.message || 'Search failed'
    });
  }
});

// Получить один твит по ID
app.get('/api/tweet/:id', async (req, res) => {
  try {
    const tweetId = req.params.id;
    
    const tweet = await readOnlyClient.v2.singleTweet(tweetId, {
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      expansions: ['author_id'],
      'user.fields': ['username', 'name', 'profile_image_url']
    });
    
    res.json({
      success: true,
      tweet: {
        id: tweet.data.id,
        text: tweet.data.text,
        created_at: tweet.data.created_at,
        metrics: tweet.data.public_metrics,
        author: tweet.includes.users[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch tweet'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  const hasCredentials = 
    process.env.TWITTER_API_KEY && 
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_SECRET;
  
  res.json({ 
    status: 'OK',
    method: 'Twitter API v2',
    authenticated: hasCredentials,
    warning: hasCredentials ? null : 'Missing API credentials'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Running',
    method: 'Twitter API v2',
    endpoints: {
      userTweets: '/api/tweets/:username',
      search: '/api/search?q=query',
      singleTweet: '/api/tweet/:id',
      health: '/health'
    },
    examples: {
      userTweets: '/api/tweets/elonmusk?limit=10',
      search: '/api/search?q=javascript&limit=20',
      singleTweet: '/api/tweet/1234567890'
    },
    requirements: 'Twitter Developer Account with API keys'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Twitter API v2 Server running on port ${port}`);
  console.log(`📡 Visit http://localhost:${port} for API info`);
});
