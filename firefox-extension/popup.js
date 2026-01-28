
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
    // Clear Cache Button
    const clearBtn = document.getElementById('clear-cache');
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            clearBtn.textContent = "✅ Cache Cleared!";
            clearBtn.style.color = "#4ade80";
            clearBtn.style.borderColor = "#22c55e";
            setTimeout(() => {
                clearBtn.textContent = "🧹 Clear Local Cache";
                clearBtn.style.color = "#a1a1aa";
                clearBtn.style.borderColor = "#3f3f46";
            }, 2000);
        });
    });
});
