// Test if GitHub raw content for Codeforces problems is accessible
import fetch from 'node-fetch';

async function testGitHubStatic() {
    const testCases = [
        { contestId: 1890, index: 'A' },
        { contestId: 1800, index: 'A' },
        { contestId: 2000, index: 'A' },
        { contestId: 1000, index: 'A' },
    ];

    for (const { contestId, index } of testCases) {
        console.log(`\n=== Testing ${contestId}${index} ===`);
        
        const urls = [
            `https://raw.githubusercontent.com/codewithsathya/codeforces-problems/main/content/${contestId}:${index}.html`,
            `https://raw.githubusercontent.com/codewithsathya/codeforces-problems/main/content/${contestId}%3A${index}.html`,
        ];
        
        for (const url of urls) {
            console.log('\nURL:', url);
            try {
                const res = await fetch(url, { timeout: 10000 });
                console.log('  Status:', res.status);
                if (res.ok) {
                    const text = await res.text();
                    console.log('  Content length:', text.length);
                    console.log('  Has problem-statement:', text.includes('problem-statement'));
                    console.log('  Has title:', text.includes('title'));
                    console.log('  Preview:', text.substring(0, 300).replace(/\n/g, ' '));
                    break; // Found working URL
                }
            } catch (e) {
                console.log('  Error:', e.message);
            }
        }
    }
}

testGitHubStatic().catch(console.error);
