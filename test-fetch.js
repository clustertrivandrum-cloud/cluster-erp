const url = 'https://bkkzrtedpkotqrvywllr.supabase.co';

async function testFetch() {
    try {
        console.log(`Fetching ${url}...`);
        const res = await fetch(url, { method: 'GET' });
        console.log(`Status: ${res.status}`);
    } catch (err) {
        console.error('Fetch failed:');
        console.error(err);
    }
}

testFetch();
