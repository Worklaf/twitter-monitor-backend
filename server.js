const express = require('express');
const { TwitterApi } = require('twitter-api-v2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Ключи из Railway Variables
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
});

// ✅ ИСПРАВЛЕНО: используем path parameter /:username
app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    // ✅ ШАГ 1: Получаем USER ID по username
    const user = await client.v2.userByUsername(username);
    
    if (!user.data) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ✅ ШАГ 2: Получаем твиты по USER ID
    const tweets = await client.v2.userTimeline(user.data.id, {
      'tweet.fields': 'created_at,public_metrics',
      'max_results': 10  // опционально: количество твитов
    });
    
    res.json({
      user: user.data,
      tweets: tweets.data.data || []
    });
    
  } catch (error) {
    console.error('Twitter API Error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// ✅ Тестовый эндпоинт (чтобы проверить что сервер работает)
app.get('/', (req, res) => {
  res.json({ status: 'Server is running!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));
