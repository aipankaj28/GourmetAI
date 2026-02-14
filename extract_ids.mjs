import fs from 'fs';

try {
    const content = fs.readFileSync('avatars.json', 'utf8');
    // Find the first '{' to start the JSON parsing
    const jsonStart = content.indexOf('{');
    if (jsonStart === -1) throw new Error('No JSON found in file');

    const data = JSON.parse(content.substring(jsonStart));
    console.log('Total Avatars:', data.data.count);
    console.log('\nTop 10 Avatars:');
    data.data.items.slice(0, 10).forEach(item => {
        console.log(`- ${item.id} (${item.name})`);
    });
} catch (e) {
    console.error('Error parsing:', e.message);
}
