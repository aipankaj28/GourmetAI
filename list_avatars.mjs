import fs from 'fs';

function getEnv(key) {
    try {
        const data = fs.readFileSync('.env.local', 'utf8');
        return data.split('\n').map(l => l.split('=')).find(a => a[0].trim() === key)[1].trim();
    } catch (e) { }
    return null;
}

const API_KEY = getEnv('VITE_HEYGEN_API_KEY');

async function run() {
    console.log('Fetching public avatars...');
    const res = await fetch('https://api.liveavatar.com/v1/avatars/public', {
        headers: { 'X-API-KEY': API_KEY, 'accept': 'application/json' }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Public Avatars:', JSON.stringify(data, null, 2));
}

run();
