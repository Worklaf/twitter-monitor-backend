const express = require('express');
const { TwitterApi } = require('twitter-api-v2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Для Twitter API v2 используем BEARER TOKEN
const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

// Только для чтения (read-only client)
const roClient = client.readOnly;

app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    console.log(`Fetching tweets for: ${username}`);
    
    // Получаем USER ID
    const user = await roClient.v2.userByUsername(username, {
      'user.fields': ['profile_image_url', 'description']
    });
    
    if (!user.data) {
      return res.status(404).json({ 
        error: 'User not found',
        username: username 
      });
    }
    
    console.log(`Found user: ${user.data.id}`);
    
    // Получаем твиты
    const timeline = await roClient.v2.userTimeline(user.data.id, {
      max_results: 10,
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      exclude: ['retweets', 'replies'] // Только оригинальные твиты
    });
    
    res.json({
      user: user.data,
      tweets: timeline.data.data || [],
      meta: timeline.data.meta
    });
    
  } catch (error) {
    console.error('❌ Twitter API Error:', error);
    
    // Детальная информация об ошибке
    res.status(error.code || 500).json({ 
      error: error.message,
      type: error.type || 'Unknown',
      code: error.code || 500,
      data: error.data || null
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    env: {
      hasBearerToken: !!process.env.TWITTER_BEARER_TOKEN,
      hasApiKey: !!process.env.TWITTER_API_KEY
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`Bearer Token: ${process.env.TWITTER_BEARER_TOKEN ? '✅ Set' : '❌ Missing'}`);
});
