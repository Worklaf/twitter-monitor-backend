const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Пути
const TEMP_DIR = os.tmpdir();
const SCRIPT_PATH = path.join(TEMP_DIR, 'twitter_scraper.py');
// Файл кук храним РЯДОМ с сервером, чтобы он не удалялся
const COOKIES_PATH = path.join(__dirname, 'cookies.json'); 

// Определяем команду запуска (python или python3)
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// Python-скрипт
const pythonScript = `
import sys
import json
import asyncio
import os

try:
    from twikit import Client
except ImportError:
    print(json.dumps({'error': 'Module twikit not found. Run: pip install twikit'}), file=sys.stderr)
    sys.exit(1)

# ВАШИ ДАННЫЕ
USERNAME = 'biancaxharden@gmail.com'
EMAIL = 'biancaxharden@gmail.com'
PASSWORD = 'qM28xQZc3PfDaHP'

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Arguments missing'}), file=sys.stderr)
        sys.exit(1)

    target_user = sys.argv[1]
    limit = int(sys.argv[2])
    cookies_path = sys.argv[3] # Получаем путь к кукам от Node.js

    client = Client('en-US')
    
    # 1. Пытаемся загрузить куки
    loggedIn = False
    if os.path.exists(cookies_path):
        try:
            client.load_cookies(cookies_path)
            loggedIn = True
        except Exception:
            pass # Если куки старые или битые, будем логиниться заново

    # 2. Если не загрузили куки, логинимся с паролем
    if not loggedIn:
        try:
            await client.login(auth_info_1=USERNAME, auth_info_2=EMAIL, password=PASSWORD)
            client.save_cookies(cookies_path) # СОХРАНЯЕМ КУКИ НА БУДУЩЕЕ
        except Exception as e:
            error_msg = str(e)
            if "403" in error_msg:
                error_msg = "Twitter blocked the login attempt (Cloudflare 403). Try waiting or using cookies."
            print(json.dumps({'error': error_msg}), file=sys.stderr)
            sys.exit(1)

    try:
        # Получаем пользователя
        user = await client.get_user_by_screen_name(target_user)
        
        # Получаем твиты
        tweets = await client.get_user_tweets(user.id, 'Tweets', count=limit)
        
        result = []
        if tweets:
            for tweet in tweets:
                result.append({
                    'id': tweet.id,
                    'text': tweet.text,
                    'created_at': str(tweet.created_at),
                    'favorite_count': tweet.favorite_count,
                    'retweet_count': tweet.retweet_count,
                    'view_count': getattr(tweet, 'view_count', None),
                    'reply_count': getattr(tweet, 'reply_count', 0),
                })
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
`;

async function initScript() {
  try {
    await fs.writeFile(SCRIPT_PATH, pythonScript);
    console.log(`✅ Python script updated at: ${SCRIPT_PATH}`);
    console.log(`🍪 Cookies will be saved to: ${COOKIES_PATH}`);
  } catch (error) {
    console.error('❌ Failed to create script:', error);
  }
}

app.get('/api/tweets/:username', async (req, res) => {
  const { username } = req.params;
  console.log(`📡 Fetching tweets for: ${username}`);
  
  // Передаем путь к кукам третьим аргументом
  const proc = spawn(PYTHON_CMD, [SCRIPT_PATH, username, '20', COOKIES_PATH]);
  
  let output = '';
  let errorOutput = '';
  
  proc.stdout.on('data', (data) => output += data.toString());
  proc.stderr.on('data', (data) => errorOutput += data.toString());
  
  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Process exited with code ${code}`);
      
      try {
          const errJson = JSON.parse(errorOutput);
          return res.status(500).json(errJson);
      } catch {
          // Если ошибка HTML (как Cloudflare), просто отдаем текст
          console.error(errorOutput);
          return res.status(500).json({ error: 'Blocked by Twitter or Script Failed', details: 'Check server console for logs' });
      }
    }
    
    try {
      if (!output.trim()) return res.json([]); 
      const tweets = JSON.parse(output);
      console.log(`✅ Success! Found ${tweets.length} tweets.`);
      res.json(tweets);
    } catch (error) {
      console.error('❌ JSON Parse Error:', error);
      res.status(500).json({ error: 'Failed to parse Python response' });
    }
  });
});

(async () => {
  await initScript();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})();
