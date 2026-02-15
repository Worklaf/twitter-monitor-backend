// server.js - TWIKIT ВЕРСИЯ
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// Twitter credentials (добавь в Environment Variables на Railway)
const TWITTER_USERNAME = process.env.TWITTER_USERNAME || 'your_username';
const TWITTER_EMAIL = process.env.TWITTER_EMAIL || 'your_email@example.com';
const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD || 'your_password';

// Python script для Twikit
const pythonScript = `
import asyncio
import sys
import json
from twikit import Client

async def get_tweets(username, count=10):
    try:
        client = Client('en-US')
        
        # Логин
        await client.login(
            auth_info_1='${TWITTER_USERNAME}',
            auth_info_2='${TWITTER_EMAIL}',
            password='${TWITTER_PASSWORD}',
            cookies_file='/tmp/cookies.json'
        )
        
        # Получаем твиты пользователя
        user = await client.get_user_by_screen_name(username)
        tweets = await user.get_tweets('Tweets', count=count)
        
        # Форматируем результат
        result = {
            'user': {
                'username': user.screen_name,
                'name': user.name,
                'followers': user.followers_count,
                'bio': user.description
            },
            'tweets': []
        }
        
        for tweet in tweets:
            result['tweets'].append({
                'id': tweet.id,
                'text': tweet.text,
                'created_at': str(tweet.created_at),
                'likes': tweet.favorite_count,
                'retweets': tweet.retweet_count,
                'replies': tweet.reply_count,
                'url': f'https://twitter.com/{username}/status/{tweet.id}'
            })
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'elonmusk'
    asyncio.run(get_tweets(username))
`;

// Сохраняем Python скрипт
const fs = require('fs').promises;
const scriptPath = '/tmp/twitter_scraper.py';

async function initScript() {
  await fs.writeFile(scriptPath, pythonScript);
  console.log('✅ Python script created');
}

initScript().catch(console.error);

app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username;
    console.log(`📡 Fetching tweets for: ${username}`);
    
    // Запускаем Python скрипт
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath} ${username}`);
    
    if (stderr) {
      console.error('Python error:', stderr);
      return res.status(500).json({ 
        error: 'Failed to fetch tweets',
        details: stderr 
      });
    }
    
    const data = JSON.parse(stdout);
    res.json({
      success: true,
      ...data
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      note: 'Make sure TWITTER credentials are set in environment variables'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    method: 'Twikit (no API key needed)',
    authenticated: !!(TWITTER_USERNAME && TWITTER_PASSWORD)
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Running',
    method: 'Twikit Twitter Scraper',
    endpoints: {
      tweets: '/api/tweets/:username',
      health: '/health'
    },
    requirements: 'Twitter account credentials needed'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Twikit Server on port ${port}`);
  console.log(`🔐 Authenticated: ${!!(TWITTER_USERNAME && TWITTER_PASSWORD)}`);
});
