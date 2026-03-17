#include <bits/stdc++.h>
using namespace std;

int main() {
    int T;
    scanf("%d", &T);
    while (T--) {
        int N;
        scanf("%d", &N);
        int n = 2 * N;
        vector<int> A(n);
        for (int i = 0; i < n; i++) scanf("%d", &A[i]);

        bool found = false;
        // Try all subsets of indices to move (2^(2N) but N is small for brute)
        for (int mask = 0; mask < (1 << n) && !found; mask++) {
            // moved positions (sorted)
            vector<int> moved, unmoved;
            for (int i = 0; i < n; i++) {
                if (mask & (1 << i)) moved.push_back(i);
                else unmoved.push_back(i);
            }
            int k = moved.size();
            // Build result: prefix (reverse of moved) + suffix (unmoved in order)
            vector<int> result;
            for (int i = k - 1; i >= 0; i--) result.push_back(A[moved[i]]);
            for (int i = 0; i < (int)unmoved.size(); i++) result.push_back(A[unmoved[i]]);
            // Check palindrome
            bool isPalin = true;
            for (int i = 0; i < n / 2; i++) {
                if (result[i] != result[n - 1 - i]) { isPalin = false; break; }
            }
            if (isPalin) found = true;
        }
        printf("%s\n", found ? "Yes" : "No");
    }
    return 0;
}
