/**
 * A2Z DSA Sheet Pre-Scraping Script
 * 
 * This script pre-scrapes all LeetCode and GeeksforGeeks problems
 * from the A2Z DSA Sheet and saves them to a JSON cache file.
 * 
 * Usage: node scripts/scrape_a2z_cache.js
 */

const fs = require('fs');
const path = require('path');

// Load A2Z data
const a2zPath = path.join(__dirname, '../../frontend/src/components/a2z.json');
const a2zData = JSON.parse(fs.readFileSync(a2zPath, 'utf-8'));

// Output cache path
const cachePath = path.join(__dirname, '../../frontend/src/components/a2z-cache.json');

// LeetCode GraphQL endpoint
const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

// Helper to extract slug from URL
const extractSlug = (url, platform) => {
    try {
        if (platform === 'leetcode') {
            const match = url.match(/\/problems\/([^\/]+)/);
            return match ? match[1] : null;
        } else if (platform === 'geeksforgeeks') {
            const match = url.match(/\/problems\/([^\/]+)/);
            return match ? match[1] : null;
        }
        return null;
    } catch {
        return null;
    }
};

// Fetch LeetCode problem
async function fetchLeetCode(slug) {
    const query = `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionId
                title
                titleSlug
                content
                difficulty
                topicTags { name slug }
                exampleTestcases
                sampleTestCase
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
        if (data?.data?.question) {
            const q = data.data.question;
            return {
                title: q.title,
                titleSlug: q.titleSlug,
                questionId: q.questionId,
                description: q.content || '',
                difficulty: q.difficulty,
                tags: q.topicTags?.map(t => t.name) || [],
                testCases: q.exampleTestcases || q.sampleTestCase || ''
            };
        }
    } catch (err) {
        console.error(`  LeetCode fetch error for ${slug}:`, err.message);
    }
    return null;
}

// Fetch GFG problem (via HTML scraping with multiple patterns)
async function fetchGFG(slug) {
    const url = `https://www.geeksforgeeks.org/problems/${slug}/1`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = await res.text();
        
        // Try to extract from Next.js __NEXT_DATA__ script
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const pageProps = nextData?.props?.pageProps;
                if (pageProps?.problem?.problem_description || pageProps?.description) {
                    return {
                        title: pageProps?.problem?.problem_name || pageProps?.title || slug,
                        description: pageProps?.problem?.problem_description || pageProps?.description || '',
                        difficulty: pageProps?.problem?.difficulty || 'Medium'
                    };
                }
            } catch (e) {
                // JSON parse failed, continue with regex
            }
        }

        // Multiple regex patterns for description extraction
        const patterns = [
            /<div[^>]*class="[^"]*problems_problem_content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*problems/i,
            /<div[^>]*class="problems_problem_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="problem-statement"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="problems_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*id="problem-description"[^>]*>([\s\S]*?)<\/div>/i
        ];

        let description = '';
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].trim().length > 50) {
                description = match[1].trim();
                break;
            }
        }

        // Extract title
        const titlePatterns = [
            /<h1[^>]*class="[^"]*problems_header_content__title[^"]*"[^>]*>([^<]+)/i,
            /<title>([^|<]+)/i
        ];
        
        let title = slug.replace(/-/g, ' ').replace(/\d+$/, '').trim();
        for (const pattern of titlePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                title = match[1].trim().replace(' | GeeksforGeeks', '').replace(' - GeeksforGeeks', '');
                break;
            }
        }

        // Extract difficulty
        const difficultyMatch = html.match(/(Easy|Medium|Hard|Basic)/i);
        const difficulty = difficultyMatch ? difficultyMatch[1] : 'Medium';

        if (description) {
            return { title, description, difficulty };
        }
    } catch (err) {
        console.error(`  GFG fetch error for ${slug}:`, err.message);
    }
    return null;
}

// Main scraping function
async function scrapeAll() {
    console.log('🚀 Starting A2Z DSA Sheet Pre-Scraping...\n');
    
    // Load existing cache if available
    let existingCache = { problems: {} };
    try {
        existingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        console.log(`📂 Loaded existing cache with ${Object.keys(existingCache.problems).length} problems\n`);
    } catch {
        console.log('📂 No existing cache found, starting fresh\n');
    }

    const cache = {
        lastUpdated: new Date().toISOString().split('T')[0],
        version: "2.0",
        problems: { ...existingCache.problems }
    };

    let scraped = 0;
    let skipped = 0;
    let failed = 0;

    for (const topic of a2zData) {
        // Support both old format (topic.title) and new format (topic.topic)
        const topicName = topic.topic || topic.title;
        console.log(`\n📁 ${topicName} (${topic.problems.length} problems)`);
        
        for (const problem of topic.problems) {
            // Support both old format (platformLink, platform) and new format (url, provider)
            const platformLink = problem.url || problem.platformLink;
            const platform = (problem.provider || problem.platform || '').toLowerCase();
            const slug = extractSlug(platformLink, platform);
            
            // Skip if already in cache with description
            if (cache.problems[problem.id]?.description && cache.problems[problem.id].description.length > 100) {
                console.log(`  ⏭️  ${problem.title} (cached)`);
                skipped++;
                continue;
            }

            // Skip unsupported platforms
            if (platform !== 'leetcode' && platform !== 'geeksforgeeks' && platform !== 'gfg') {
                console.log(`  ⚠️  ${problem.title} (${platform} - not supported)`);
                
                // Add basic entry with external link
                cache.problems[problem.id] = {
                    id: problem.id,
                    title: problem.title,
                    provider: platform,
                    difficulty: problem.difficulty,
                    url: platformLink,
                    description: `<div style="padding: 24px; text-align: center;">
                        <h2 style="color: #fff; margin-bottom: 16px;">${problem.title}</h2>
                        <p style="color: #a1a1aa; margin-bottom: 24px;">
                            This problem is from <strong>${platform}</strong>.
                        </p>
                        <a href="${platformLink}" target="_blank" rel="noopener noreferrer" 
                           style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; 
                                  background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; 
                                  text-decoration: none; border-radius: 8px; font-weight: 600;">
                            Open on ${platform}
                        </a>
                    </div>`
                };
                skipped++;
                continue;
            }

            console.log(`  🔄 Fetching: ${problem.title}...`);

            let result = null;
            
            if ((platform === 'leetcode') && slug) {
                result = await fetchLeetCode(slug);
            } else if ((platform === 'geeksforgeeks' || platform === 'gfg') && slug) {
                result = await fetchGFG(slug);
            }

            if (result && result.description) {
                cache.problems[problem.id] = {
                    id: problem.id,
                    title: result.title || problem.title,
                    titleSlug: result.titleSlug || slug,
                    questionId: result.questionId,
                    provider: platform,
                    difficulty: result.difficulty || problem.difficulty,
                    url: platformLink,
                    description: result.description,
                    tags: result.tags || [],
                    testCases: result.testCases || ''
                };
                console.log(`  ✅ ${problem.title}`);
                scraped++;
            } else {
                console.log(`  ❌ ${problem.title} (failed to fetch)`);
                
                // Add fallback entry
                cache.problems[problem.id] = {
                    id: problem.id,
                    title: problem.title,
                    provider: platform,
                    difficulty: problem.difficulty,
                    url: platformLink,
                    description: `<div style="padding: 24px; text-align: center;">
                        <h2 style="color: #fff; margin-bottom: 16px;">${problem.title}</h2>
                        <p style="color: #a1a1aa; margin-bottom: 24px;">
                            Problem description could not be fetched.<br/>
                            Click below to view on the original platform.
                        </p>
                        <a href="${platformLink}" target="_blank" rel="noopener noreferrer" 
                           style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; 
                                  background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; 
                                  text-decoration: none; border-radius: 8px; font-weight: 600;">
                            View on ${platform === 'geeksforgeeks' || platform === 'gfg' ? 'GeeksforGeeks' : 'LeetCode'}
                        </a>
                    </div>`
                };
                failed++;
            }

            // Rate limiting - wait 500ms between requests
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Save cache
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Scraped: ${scraped}`);
    console.log(`⏭️  Skipped (cached/unsupported): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Total in cache: ${Object.keys(cache.problems).length}`);
    console.log(`💾 Saved to: ${cachePath}`);
    console.log('='.repeat(50));
}

// Run
scrapeAll().catch(console.error);
