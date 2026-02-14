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

async function run() {
    const res = await fetch('https://api.liveavatar.com/v1/avatars/public', {
        headers: { 'X-API-KEY': API_KEY, 'accept': 'application/json' }
    });
    const data = await res.json();
    if (data.data && data.data.results) {
        data.data.results.forEach(item => {
            console.log(`ID: ${item.id} | Name: ${item.name}`);
        });
    } else {
        console.log('Error or different format:', JSON.stringify(data, null, 2));
    }
}

run();
