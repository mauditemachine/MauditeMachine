import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3002;

// Config from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'mauditemachine/MauditeMachine';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://mauditemachine.com';

app.use(cors({ origin: [ALLOWED_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '50mb' }));

// Simple API key auth middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!ADMIN_API_KEY || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

// GitHub API helper: get file (returns sha + content)
async function getGitHubFile(filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json();
}

// GitHub API helper: create or update a file
async function updateGitHubFile(filePath, content, message) {
  const existing = await getGitHubFile(filePath);
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: 'main',
  };
  if (existing) body.sha = existing.sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} - ${err}`);
  }
  return res.json();
}

// GitHub API helper: upload binary file (base64)
async function uploadGitHubBinary(filePath, base64Data, message) {
  const existing = await getGitHubFile(filePath);
  const body = {
    message,
    content: base64Data,
    branch: 'main',
  };
  if (existing) body.sha = existing.sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} - ${err}`);
  }
  return res.json();
}

// Save events
app.post('/api/save-events', authMiddleware, async (req, res) => {
  try {
    const events = req.body;
    const content = JSON.stringify(events, null, 2);
    await updateGitHubFile('public/events.json', content, 'Update events from admin panel');
    console.log('Events saved to GitHub');
    res.json({ success: true, message: 'Events saved & deploy triggered' });
  } catch (error) {
    console.error('Save events error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save messages
app.post('/api/save-messages', authMiddleware, async (req, res) => {
  try {
    const messages = req.body;
    const content = JSON.stringify(messages, null, 2);
    await updateGitHubFile('public/messages.json', content, 'Update messages from admin panel');
    console.log('Messages saved to GitHub');
    res.json({ success: true, message: 'Messages saved & deploy triggered' });
  } catch (error) {
    console.error('Save messages error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save merch
app.post('/api/save-merch', authMiddleware, async (req, res) => {
  try {
    const merchItems = req.body;
    const content = JSON.stringify(merchItems, null, 2);
    await updateGitHubFile('public/store.json', content, 'Update store from admin panel');
    console.log('Merch saved to GitHub');
    res.json({ success: true, message: 'Store saved & deploy triggered' });
  } catch (error) {
    console.error('Save merch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload image
app.post('/api/upload-image', authMiddleware, async (req, res) => {
  try {
    const { base64, filename, folder } = req.body;
    if (!base64 || !filename) {
      return res.status(400).json({ success: false, message: 'Missing base64 or filename' });
    }
    const targetFolder = folder || 'images';
    const filePath = `public/${targetFolder}/${filename}`;

    // Strip data URI prefix if present
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

    await uploadGitHubBinary(filePath, cleanBase64, `Upload image: ${filename}`);
    console.log('Image uploaded to GitHub:', filePath);
    res.json({
      success: true,
      imagePath: `${targetFolder}/${filename}`,
      message: 'Image uploaded & deploy triggered',
    });
  } catch (error) {
    console.error('Upload image error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', repo: GITHUB_REPO });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`GitHub repo: ${GITHUB_REPO}`);
});
