#include <bits/stdc++.h>
using namespace std;

int ask(int l, int r){
    cout << "? " << l << " " << r << "\n";
    cout.flush();
    int v; cin >> v;
    if(v == -1) exit(0);
    return v;
}

void solve(){
    int n; cin >> n;
    double budget = max(30.0, 3.0*n);
    double spent = 0;

    // g_s[i] = gcd(n-i+1, K_i), K_i = #1s in s[i..n]
    // g_p[j] = gcd(j, P_j),     P_j = #1s in s[1..j]
    vector<int> g_s(n+1, -1), g_p(n+1, -1);

    // Suffix queries f(i,n), cheap for small i
    for(int i = 1; i <= n; i++){
        int m = n-i+1;
        double c = (double)n/m;
        if(spent + c > budget/2.0 + 1e-9) break;
        spent += c;
        int f = ask(i, n);
        g_s[i] = m / f;
    }
    // Prefix queries f(1,j), cheap for large j
    for(int j = n; j >= 2; j--){
        double c = (double)n/j;
        if(spent + c > budget + 1e-9) break;
        spent += c;
        int f = ask(1, j);
        g_p[j] = j / f;
    }

    // Find ranges covered
    int A = 0; // suffix queries cover i=1..A
    for(int i = 1; i <= n; i++){
        if(g_s[i] != -1) A = i; else break;
    }
    int B = n+1; // prefix queries cover j=B..n
    for(int j = 1; j <= n; j++){
        if(g_p[j] != -1){ B = j; break; }
    }

    // DP on suffix side: propagate possible K values
    // K_i = #1s in s[i..n], K_{i+1} = K_i - s_i
    // valid_K[i] stores which K values are possible
    // We store them as sorted vectors for efficiency
    int maxA = min(A+1, n+1);

    // For position 1: K_1 must satisfy gcd(n, K_1) == g_s[1]
    vector<vector<bool>> vK(maxA+1, vector<bool>(n+2, false));
    {
        int m = n, g = g_s[1];
        for(int k = 0; k <= m; k++)
            if(__gcd(m, k) == g) vK[1][k] = true;
    }

    // Forward propagation
    for(int i = 2; i <= maxA; i++){
        int m = n - i + 1;
        int g = (g_s[i] != -1) ? g_s[i] : -1;
        for(int k = 0; k <= n; k++){
            if(!vK[i-1][k]) continue;
            // K_i = k (s_{i-1}=0) or k-1 (s_{i-1}=1)
            for(int nk : {k, k-1}){
                if(nk < 0 || nk > m) continue;
                if(g != -1 && __gcd(m, nk) != g) continue;
                vK[i][nk] = true;
            }
        }
    }

    // Now for each valid K at position maxA, try prefix propagation
    // and reconstruct the string
    auto tryReconstruct = [&](int startK) -> string {
        // Backward trace suffix to get K_1..K_{maxA}
        vector<int> K(n+2, -1);
        K[maxA] = startK;
        for(int i = maxA-1; i >= 1; i--){
            // K[i] in {K[i+1], K[i+1]+1}
            int m = n - i + 1;
            int g = g_s[i];
            int c1 = K[i+1], c2 = K[i+1]+1;
            if(c1 >= 0 && c1 <= m && __gcd(m, c1) == g && vK[i][c1])
                K[i] = c1;
            else if(c2 >= 0 && c2 <= m && __gcd(m, c2) == g && vK[i][c2])
                K[i] = c2;
            else return ""; // invalid
        }

        // Build s from suffix side: s_i = K[i] - K[i+1]
        string s(n, '0');
        for(int i = 1; i < maxA; i++){
            s[i-1] = (K[i] - K[i+1]) ? '1' : '0';
        }

        // Continue with prefix side for remaining positions
        // P_j = K[1] - K[j+1], so K[j+1] = K[1] - P_j
        // We propagate P from the overlap point
        int k1 = K[1];
        // P at position maxA-1: P = k1 - K[maxA]
        int P = k1 - K[maxA];

        for(int j = maxA; j <= n; j++){
            // s_j determines P_j = P_{j-1} + s_j
            // K[j+1] = k1 - P_j
            // Try s_j = 0 and s_j = 1
            bool found = false;
            for(int sj = 0; sj <= 1; sj++){
                int newP = P + sj;
                if(newP < 0 || newP > j) continue;
                int newK = k1 - newP;
                if(newK < 0 || newK > n-j) continue;
                // Check prefix constraint
                if(g_p[j] != -1 && __gcd(j, newP) != g_p[j]) continue;
                // Check suffix constraint if available
                if(j+1 <= n && g_s[j+1] != -1 && __gcd(n-j, newK) != g_s[j+1]) continue;
                // Accept this
                s[j-1] = sj ? '1' : '0';
                P = newP;
                K[j+1] = newK;
                found = true;
                break;
            }
            if(!found) return ""; // invalid
        }
        // Final check: P_n should equal K[1]
        if(P != k1) return "";
        return s;
    };

    // Try each valid K at position maxA
    string ans = "";
    for(int k = 0; k <= n && ans.empty(); k++){
        if(vK[maxA][k]) ans = tryReconstruct(k);
    }

    if(ans.empty()){
        // Fallback: guess all zeros
        ans = string(n, '0');
    }

    // Guess 1: ans
    cout << "! " << ans << "\n";
    cout.flush();
    int res; cin >> res;
    if(res == -1) exit(0);
    if(res == 1) return;

    // Guess 2: complement
    string comp = ans;
    for(auto& c : comp) c = (c == '0') ? '1' : '0';
    cout << "! " << comp << "\n";
    cout.flush();
    cin >> res;
    if(res == -1) exit(0);
}

int main(){
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int t; cin >> t;
    while(t--) solve();
    return 0;
}
