const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Пути
const TEMP_DIR = os.tmpdir();
const SCRIPT_PATH = path.join(TEMP_DIR, 'twitter_scraper.py');
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// ОБНОВЛЕННЫЙ Python скрипт с cookies
const pythonScript = `
import sys
import json
import os
from twikit import Client

USERNAME = 'biancaxharden@gmail.com'
EMAIL = 'biancaxharden@gmail.com'
PASSWORD = 'qM28xQZc3PfDaHP'
COOKIES_FILE = 'twitter_cookies.json'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async def main():
    client = Client(language='en-US', user_agent=USER_AGENT)
    
    try:
        if os.path.exists(COOKIES_FILE):
            client.load_cookies(COOKIES_FILE)
        else:
            await client.login(
                auth_info_1=USERNAME,
                auth_info_2=EMAIL,
                password=PASSWORD,
                cookies_file=COOKIES_FILE,
                enable_ui_metrics=True
            )
        
        user = await client.get_user_by_screen_name(sys.argv[1])
        tweets = await client.get_user_tweets(user.id, 'Tweets', count=int(sys.argv[2]) if len(sys.argv) > 2 else 20)
        
        result = []
        for tweet in tweets:
            result.append({
                'id': tweet.id,
                'text': tweet.text,
                'created_at': tweet.created_at,
                'favorite_count': tweet.favorite_count,
                'retweet_count': tweet.retweet_count,
                'view_count': getattr(tweet, 'view_count', None),
                'reply_count': getattr(tweet, 'reply_count', 0),
            })
        
        print(json.dumps(result, default=str))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`;

// Инициализация
async function initScript() {
  try {
    await fs.writeFile(SCRIPT_PATH, pythonScript);
    console.log('✅ Python script created');
  } catch (error) {
    console.error('❌ Failed to create script:', error);
  }
}

// Проверка аутентификации
async function checkAuth() {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_CMD, [SCRIPT_PATH, 'twitter', '1']);
    let output = '';
    
    proc.stderr.on('data', (data) => {
      console.log('🔐', data.toString().trim());
    });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    
    proc.on('error', () => resolve(false));
  });
}

// API endpoint
app.get('/api/tweets/:username', async (req, res) => {
  const { username } = req.params;
  const limit = req.query.limit || '20';
  
  console.log(`📡 Fetching tweets for: ${username}`);
  
  const proc = spawn(PYTHON_CMD, [SCRIPT_PATH, username, limit]);
  let output = '';
  let errorOutput = '';
  
  proc.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  proc.stderr.on('data', (data) => {
    const msg = data.toString();
    errorOutput += msg;
    // Показываем только информационные сообщения
    if (msg.includes('✅')) {
      console.log(msg.trim());
    }
  });
  
  proc.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Error:', errorOutput);
      return res.status(500).json({ 
        error: 'Failed to fetch tweets', 
        details: errorOutput 
      });
    }
    
    try {
      const tweets = JSON.parse(output);
      console.log(`✅ Fetched ${tweets.length} tweets`);
      res.json(tweets);
    } catch (error) {
      console.error('❌ Parse error:', error);
      res.status(500).json({ error: 'Failed to parse response' });
    }
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Twitter Monitor API',
    pythonCmd: PYTHON_CMD,
    platform: process.platform
  });
});

// Запуск
(async () => {
  await initScript();
  
  app.listen(PORT, async () => {
    console.log(`🚀 Twikit Server on port ${PORT}`);
    const isAuth = await checkAuth();
    console.log(`🔐 Authenticated: ${isAuth}`);
  });
})();
