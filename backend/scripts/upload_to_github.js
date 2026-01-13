/**
 * Upload Scraped Problems to GitHub
 * 
 * This script helps you push scraped Codeforces problems to your GitHub repository.
 * 
 * Prerequisites:
 * 1. Create a GitHub repository named "codeforces-problems"
 * 2. Set up git in the codeforces-problems folder
 * 
 * Usage:
 *   node upload_to_github.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_DIR = path.join(__dirname, '..', '..', 'codeforces-problems');
const CONTENT_DIR = path.join(REPO_DIR, 'content');

const run = (cmd, cwd = REPO_DIR) => {
    console.log(`$ ${cmd}`);
    try {
        return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return null;
    }
};

const main = async () => {
    console.log('📤 GitHub Upload Script for Codeforces Problems');
    console.log('='.repeat(50));
    
    // Check if content directory exists
    if (!fs.existsSync(CONTENT_DIR)) {
        console.error('❌ No content directory found. Run scrape_codeforces_problems.js first.');
        process.exit(1);
    }
    
    // Count files
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'));
    console.log(`\n📁 Found ${files.length} problem files to upload\n`);
    
    if (files.length === 0) {
        console.log('No files to upload. Run the scraper first.');
        process.exit(0);
    }
    
    // Check if git is initialized
    const gitDir = path.join(REPO_DIR, '.git');
    if (!fs.existsSync(gitDir)) {
        console.log('🔧 Initializing git repository...\n');
        run('git init');
        
        console.log('\n⚠️  Repository initialized. Please configure remote:');
        console.log('   1. Create a repository on GitHub named "codeforces-problems"');
        console.log('   2. Run: git remote add origin https://github.com/YOUR_USERNAME/codeforces-problems.git');
        console.log('   3. Run this script again\n');
        process.exit(0);
    }
    
    // Check remote
    const remotes = run('git remote -v');
    if (!remotes || !remotes.includes('origin')) {
        console.log('⚠️  No remote configured. Please add one:');
        console.log('   git remote add origin https://github.com/YOUR_USERNAME/codeforces-problems.git');
        process.exit(1);
    }
    
    console.log('📡 Remote configured:', remotes.split('\n')[0]);
    
    // Stage all changes
    console.log('\n📦 Staging changes...');
    run('git add -A');
    
    // Check status
    const status = run('git status --porcelain');
    if (!status || status.trim() === '') {
        console.log('✅ Everything up to date. No changes to push.');
        process.exit(0);
    }
    
    const changedFiles = status.trim().split('\n').length;
    console.log(`   ${changedFiles} files changed\n`);
    
    // Commit
    const timestamp = new Date().toISOString().split('T')[0];
    const commitMsg = `Update problems - ${timestamp} (${changedFiles} files)`;
    console.log(`💾 Committing: "${commitMsg}"`);
    run(`git commit -m "${commitMsg}"`);
    
    // Push
    console.log('\n🚀 Pushing to GitHub...');
    const pushResult = run('git push -u origin main');
    
    if (pushResult !== null) {
        console.log('\n✅ Successfully pushed to GitHub!');
        console.log('\n📍 Your problems are now available at:');
        
        // Try to get the remote URL
        const remoteUrl = run('git remote get-url origin');
        if (remoteUrl) {
            const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
            if (match) {
                const repoPath = match[1].replace('.git', '');
                console.log(`   https://raw.githubusercontent.com/${repoPath}/main/content/{contestId}:{index}.html`);
            }
        }
    } else {
        console.log('\n❌ Push failed. You may need to:');
        console.log('   1. Set up GitHub authentication');
        console.log('   2. Try: git push -u origin main --force (if first push)');
    }
    
    console.log('\n' + '='.repeat(50));
};

main().catch(console.error);
