import fs from 'fs';

function getEnv(key) {
    try {
        const data = fs.readFileSync('.env.local', 'utf8');
        const line = data.split('\n').find(l => l.startsWith(key + '='));
        return line ? line.split('=')[1].trim() : null;
    } catch (e) { }
    return null;
}

const API_KEY = getEnv('VITE_HEYGEN_API_KEY');
const AVATAR_ID = '8175dfc2-7858-49d6-b5fa-0c135d1c4bad';
const API_BASE = 'https://api.liveavatar.com/v1';

async function run() {
    console.log('API_KEY:', API_KEY ? 'Present' : 'Missing');

    const tokenRes = await fetch(`${API_BASE}/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'LITE', avatar_id: AVATAR_ID })
    });
    const tokenJson = await tokenRes.json();
    const session_token = tokenJson.data?.session_token;
    console.log('Session Token Received:', !!session_token);

    const startRes = await fetch(`${API_BASE}/sessions/start`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    console.log('Start Status:', startRes.status);
    const startJson = await startRes.json();
    console.log('Full Start Response:', JSON.stringify(startJson, null, 2));
}

run();
