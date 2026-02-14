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
    if (!API_KEY) {
        console.error('ERROR: VITE_HEYGEN_API_KEY missing');
        return;
    }

    console.log('--- Step 1: Create Token ---');
    const tokenRes = await fetch(`${API_BASE}/sessions/token`, {
        method: 'POST',
        headers: {
            'X-API-KEY': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mode: 'LITE',
            avatar_id: AVATAR_ID
        })
    });

    const tokenJson = await tokenRes.json();
    console.log('Token Status:', tokenRes.status);

    const session_token = tokenJson.data?.session_token;
    if (!session_token) {
        console.error('No token found in response:', JSON.stringify(tokenJson, null, 2));
        return;
    }

    console.log('Token found (length):', session_token.length);

    console.log('\n--- Step 2: Start Session ---');
    const startRes = await fetch(`${API_BASE}/sessions/start`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });
    console.log('Start Status:', startRes.status);
    const startData = await startRes.json();
    console.log('Start Data:', JSON.stringify(startData, null, 2));
}

run();
