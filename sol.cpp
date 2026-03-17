#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int t;
    cin >> t;
    while (t--) {
        string s;
        cin >> s;
        int n = s.size();
        
        // If single digit, S(x) = "x", just output it
        if (n == 1) {
            cout << s << "\n";
            continue;
        }
        
        // Count digit frequencies in s
        int freq[10] = {};
        for (char c : s) freq[c - '0']++;
        
        bool found = false;
        // Try all possible digit sums d1 for x
        for (int d1 = 1; d1 <= 9 * n && !found; d1++) {
            // Compute tail's digit frequencies and length
            int tailFreq[10] = {};
            int tailLen = 0;
            int cur = d1;
            
            while (true) {
                int tmp = cur, ds = 0;
                do {
                    tailFreq[tmp % 10]++;
                    ds += tmp % 10;
                    tailLen++;
                    tmp /= 10;
                } while (tmp > 0);
                if (cur <= 9) break;
                cur = ds;
            }
            
            // x must have at least 2 digits (since x >= 10 for |s| > 1)
            int xLen = n - tailLen;
            if (xLen < 2) continue;
            
            // Check: can we subtract tail digits from s, and do remainders sum to d1?
            bool valid = true;
            int remSum = 0;
            bool hasNonZero = false;
            for (int d = 0; d < 10; d++) {
                if (freq[d] < tailFreq[d]) { valid = false; break; }
                int rem = freq[d] - tailFreq[d];
                remSum += d * rem;
                if (d > 0 && rem > 0) hasNonZero = true;
            }
            
            if (!valid || remSum != d1 || !hasNonZero) continue;
            
            // Build x (sorted descending to avoid leading zeros)
            string x_str = "";
            for (int d = 9; d >= 0; d--)
                x_str += string(freq[d] - tailFreq[d], '0' + d);
            
            // Build tail string
            string tail = "";
            cur = d1;
            while (true) {
                tail += to_string(cur);
                if (cur <= 9) break;
                int ds = 0, tmp = cur;
                while (tmp > 0) { ds += tmp % 10; tmp /= 10; }
                cur = ds;
            }
            
            cout << x_str << tail << "\n";
            found = true;
        }
    }
    return 0;
}
