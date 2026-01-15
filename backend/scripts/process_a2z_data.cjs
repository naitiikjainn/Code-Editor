/**
 * Process the raw A2Z DOM data to create a clean problem list
 * 
 * Usage: node scripts/process_a2z_data.cjs
 */

const fs = require('fs');
const path = require('path');

// Read the raw DOM data
const rawDataPath = path.join(__dirname, 'a2z_dom_data.json');
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));

console.log(`📊 Processing ${rawData.length} raw entries...\n`);

// Extract unique problems by URL
const problemMap = new Map();

rawData.forEach(item => {
    const url = item.url;
    
    // Skip if not a valid practice URL
    if (!url || 
        (!url.includes('leetcode.com/problems/') && 
         !url.includes('geeksforgeeks.org/problems/') &&
         !url.includes('practice.geeksforgeeks.org/problems/'))) {
        return;
    }
    
    // Skip discussion links
    if (url.includes('/discuss/')) return;
    if (url.includes('/description/')) {
        // Clean up description suffix
        item.url = url.replace('/description/', '/');
    }
    
    // Normalize URL
    let normalizedUrl = item.url.replace(/\/$/, ''); // Remove trailing slash
    normalizedUrl = normalizedUrl.split('#')[0]; // Remove hash
    normalizedUrl = normalizedUrl.split('?')[0]; // Remove query params
    
    if (!problemMap.has(normalizedUrl)) {
        problemMap.set(normalizedUrl, item);
    }
});

console.log(`✅ Found ${problemMap.size} unique problem URLs\n`);

// Now let's create the a2z.json format
// Group by topic based on the fullRow content
const topics = {
    "Learn the basics": [],
    "Sorting Techniques": [],
    "Arrays": [],
    "Binary Search": [],
    "Strings (Basic and Medium)": [],
    "LinkedList": [],
    "Recursion": [],
    "Bit Manipulation": [],
    "Stack and Queues": [],
    "Sliding Window & Two Pointer": [],
    "Heaps": [],
    "Greedy Algorithms": [],
    "Binary Trees": [],
    "Binary Search Trees": [],
    "Graphs": [],
    "Dynamic Programming": [],
    "Tries": [],
    "Strings (Advanced)": []
};

// Helper to extract problem title from LeetCode URL
function extractTitleFromUrl(url) {
    if (url.includes('leetcode.com/problems/')) {
        const match = url.match(/leetcode\.com\/problems\/([^\/\?#]+)/);
        if (match) {
            return match[1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
    }
    if (url.includes('geeksforgeeks.org/problems/')) {
        const match = url.match(/geeksforgeeks\.org\/problems\/([^\/\?#]+)/);
        if (match) {
            return match[1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
    }
    return '';
}

// Helper to determine topic from fullRow
function determineTopic(fullRow) {
    fullRow = fullRow.toLowerCase();
    
    if (fullRow.includes('dp ') || fullRow.includes('(dp-') || fullRow.includes('(dp ') || 
        fullRow.includes('dynamic programming')) return 'Dynamic Programming';
    if (fullRow.includes('graph') || fullRow.includes('bfs') || fullRow.includes('dfs') ||
        fullRow.includes('dijkstra') || fullRow.includes('topological')) return 'Graphs';
    if (fullRow.includes('binary tree') || fullRow.includes('tree traversal')) return 'Binary Trees';
    if (fullRow.includes('bst') || fullRow.includes('binary search tree')) return 'Binary Search Trees';
    if (fullRow.includes('trie')) return 'Tries';
    if (fullRow.includes('heap') || fullRow.includes('priority queue')) return 'Heaps';
    if (fullRow.includes('stack') || fullRow.includes('queue')) return 'Stack and Queues';
    if (fullRow.includes('linked list') || fullRow.includes('linkedlist')) return 'LinkedList';
    if (fullRow.includes('binary search') && !fullRow.includes('tree')) return 'Binary Search';
    if (fullRow.includes('array') || fullRow.includes('kadane') || fullRow.includes('subarray')) return 'Arrays';
    if (fullRow.includes('sort') && !fullRow.includes('topological')) return 'Sorting Techniques';
    if (fullRow.includes('recursion') || fullRow.includes('backtrack')) return 'Recursion';
    if (fullRow.includes('greedy')) return 'Greedy Algorithms';
    if (fullRow.includes('bit ') || fullRow.includes('xor') || fullRow.includes('bitwise')) return 'Bit Manipulation';
    if (fullRow.includes('sliding window') || fullRow.includes('two pointer')) return 'Sliding Window & Two Pointer';
    if (fullRow.includes('string') || fullRow.includes('palindrome') || fullRow.includes('anagram')) return 'Strings (Basic and Medium)';
    if (fullRow.includes('pattern') || fullRow.includes('basic')) return 'Learn the basics';
    
    return 'Arrays'; // Default
}

// Helper to determine difficulty
function determineDifficulty(fullRow) {
    fullRow = fullRow.toLowerCase();
    if (fullRow.includes('hard')) return 'Hard';
    if (fullRow.includes('easy')) return 'Easy';
    return 'Medium';
}

// Helper to determine provider
function determineProvider(url) {
    if (url.includes('leetcode.com')) return 'LeetCode';
    if (url.includes('geeksforgeeks.org')) return 'GFG';
    if (url.includes('codingninjas.com')) return 'CodingNinjas';
    return 'Unknown';
}

// Process each unique problem
const problems = [];
let id = 1;

problemMap.forEach((item, url) => {
    const title = extractTitleFromUrl(url);
    if (!title || title.length < 3) return;
    
    const topic = determineTopic(item.fullRow);
    const difficulty = determineDifficulty(item.fullRow);
    const provider = determineProvider(url);
    
    // Create slug from title
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const problem = {
        id: slug,
        title: title,
        url: url,
        provider: provider,
        difficulty: difficulty
    };
    
    problems.push(problem);
    topics[topic].push(problem);
    id++;
});

console.log('📁 Problems by topic:');
Object.entries(topics).forEach(([topic, probs]) => {
    console.log(`  ${topic}: ${probs.length} problems`);
});

// Create the a2z.json structure
const a2zData = Object.entries(topics).map(([name, probs]) => ({
    topic: name,
    count: probs.length,
    problems: probs
})).filter(t => t.count > 0);

console.log(`\n📊 Total: ${problems.length} unique problems across ${a2zData.length} topics`);

// Save to a2z.json
const outputPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'a2z.json');
fs.writeFileSync(outputPath, JSON.stringify(a2zData, null, 2));
console.log(`\n💾 Saved to: ${outputPath}`);

// Also save a summary
const summaryPath = path.join(__dirname, 'a2z_problems_summary.json');
fs.writeFileSync(summaryPath, JSON.stringify({
    totalProblems: problems.length,
    topics: a2zData.length,
    byProvider: {
        LeetCode: problems.filter(p => p.provider === 'LeetCode').length,
        GFG: problems.filter(p => p.provider === 'GFG').length,
        CodingNinjas: problems.filter(p => p.provider === 'CodingNinjas').length
    },
    byDifficulty: {
        Easy: problems.filter(p => p.difficulty === 'Easy').length,
        Medium: problems.filter(p => p.difficulty === 'Medium').length,
        Hard: problems.filter(p => p.difficulty === 'Hard').length
    }
}, null, 2));
console.log(`💾 Saved summary to: ${summaryPath}`);
