@echo off
REM Codeforces Scraper - Scheduled Task Runner
REM This script is designed to be run by Windows Task Scheduler

cd /d "%~dp0"
echo [%date% %time%] Starting scheduled scrape... >> scraper_log.txt

REM Run the scheduled scraper (50 contests, auto-push)
node scheduled_scrape.js 50 true >> scraper_log.txt 2>&1

echo [%date% %time%] Scrape completed. >> scraper_log.txt
echo. >> scraper_log.txt
