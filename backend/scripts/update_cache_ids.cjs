/**
 * Update A2Z cache with LeetCode questionId for submission support
 */
const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, '../../frontend/src/components/a2z-cache.json');
const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

async function fetchQuestionId(slug) {
    const query = `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionId
                titleSlug
            }
        }
    `;

    try {
        const res = await fetch(LEETCODE_GRAPHQL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Origin': 'https://leetcode.com',
                'Referer': `https://leetcode.com/problems/${slug}/`
            },
            body: JSON.stringify({
                query,
                variables: { titleSlug: slug }
            })
        });

        const data = await res.json();
        return data?.data?.question?.questionId || null;
    } catch (err) {
        return null;
    }
}

async function updateAll() {
    console.log('🚀 Updating cache with LeetCode questionIds...\n');

    const problems = Object.values(cache.problems).filter(
        p => p.provider === 'leetcode' && p.titleSlug && !p.questionId
    );

    console.log(`Found ${problems.length} LeetCode problems needing questionId\n`);

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        process.stdout.write(`  [${i + 1}/${problems.length}] ${problem.titleSlug}...`);

        const questionId = await fetchQuestionId(problem.titleSlug);
        
        if (questionId) {
            cache.problems[problem.id].questionId = questionId;
            console.log(` ✅ ${questionId}`);
            updated++;
        } else {
            console.log(' ❌');
            failed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    console.log(`\n✅ Updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);
}

updateAll();
