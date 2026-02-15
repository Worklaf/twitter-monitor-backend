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
  accessToken: process.env.TWITTER_ACCESS_TOKEN,  // Опционально, если нужно
  accessSecret: process.env.TWITTER_ACCESS_SECRET  // Опционально
});

app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const tweets = await client.v2.userTweets(username, { 'tweet.fields': 'created_at,public_metrics' });
    res.json(await tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));
