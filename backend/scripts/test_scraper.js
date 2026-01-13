/**
 * Test Scraper Service
 * 
 * Run with: node scripts/test_scraper.js
 */

import scraperService from "../utils/scraperService.js";

async function testScraper() {
    console.log("=== Scraper Service Test ===\n");

    // Test 1: Health Check
    console.log("1. Health Check...");
    try {
        const health = await scraperService.healthCheck();
        console.log("   Health Status:", health);
    } catch (e) {
        console.error("   Health Check Failed:", e.message);
    }

    // Test 2: Fetch a Codeforces problem
    console.log("\n2. Testing Codeforces Scraper (1850A)...");
    try {
        const cfProblem = await scraperService.fetchCodeforces("1850", "A");
        console.log("   Title:", cfProblem.title);
        console.log("   Time Limit:", cfProblem.timeLimit);
        console.log("   Test Cases:", cfProblem.testCases.length);
        console.log("   Description Length:", cfProblem.description?.length || 0);
        console.log("   ✅ Success");
    } catch (e) {
        console.error("   ❌ Failed:", e.message);
    }

    // Test 3: Fetch CSES problem
    console.log("\n3. Testing CSES Scraper (Task 1068)...");
    try {
        const csesProblem = await scraperService.fetchCSES("1068");
        console.log("   Title:", csesProblem.title);
        console.log("   Test Cases:", csesProblem.testCases.length);
        console.log("   ✅ Success");
    } catch (e) {
        console.error("   ❌ Failed:", e.message);
    }

    // Test 4: Fetch AtCoder problem
    console.log("\n4. Testing AtCoder Scraper (abc300_a)...");
    try {
        const atcoderProblem = await scraperService.fetchAtCoder("abc300", "abc300_a");
        console.log("   Title:", atcoderProblem.title);
        console.log("   Test Cases:", atcoderProblem.testCases.length);
        console.log("   ✅ Success");
    } catch (e) {
        console.error("   ❌ Failed:", e.message);
    }

    // Test 5: Cache Operations
    console.log("\n5. Testing Cache Operations...");
    try {
        // Check if previous fetch was cached
        const cached = await scraperService.cache.get("1850A");
        if (cached) {
            console.log("   Cache HIT for 1850A");
            console.log("   ✅ Caching works");
        } else {
            console.log("   Cache MISS for 1850A (may need Redis)");
        }
    } catch (e) {
        console.error("   Cache test error:", e.message);
    }

    console.log("\n=== Tests Complete ===");
}

testScraper().catch(console.error);
