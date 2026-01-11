
document.addEventListener('DOMContentLoaded', () => {
    const cfStatus = document.getElementById('cf-status');
    const lcStatus = document.getElementById('lc-status');
    const cfText = document.getElementById('cf-text');
    const lcText = document.getElementById('lc-text');

    chrome.runtime.sendMessage({ type: "CHECK_LOGIN_STATUS" }, (response) => {
        if (!response) return;

        // Codeforces
        if (response.codeforces.loggedIn) {
            cfStatus.style.background = "#22c55e"; // Green
            cfText.textContent = `Logged in as ${response.codeforces.user}`;
            cfText.style.color = "#fff";
        } else {
            cfStatus.style.background = "#ef4444"; // Red
            cfText.textContent = "Not logged in";
        }

        // LeetCode
        if (response.leetcode.loggedIn) {
            lcStatus.style.background = "#22c55e"; // Green
            lcText.textContent = "Session Active";
            lcText.style.color = "#fff";
        } else {
            lcStatus.style.background = "#ef4444"; // Red
            lcText.textContent = "Not logged in";
        }
    });
});
