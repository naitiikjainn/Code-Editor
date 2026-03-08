#include <bits/stdc++.h>
using namespace std;

int compute_kmex(vector<int>& b, int len, int k){
    set<int> vals(b.begin(), b.begin()+len);
    int miss = 0;
    for(int v = 0; ; v++){
        if(vals.find(v) == vals.end()){
            miss++;
            if(miss == k) return v;
        }
    }
}

int main(){
    srand(42);
    // Stress test: generate random valid a, solve, verify
    int tests = 0, pass = 0;
    for(int iter = 0; iter < 100000; iter++){
        int n = 1 + rand()%5;
        // Generate valid a: non-increasing, a[i] in [n-i-1, n]
        vector<int> a(n);
        a[0] = n - (rand()%2); // n or n-1
        for(int i = 1; i < n; i++){
            int lo = max(n - i - 1, 0);
            int hi = a[i-1]; // non-increasing
            if(lo > hi){ a[i] = lo; } // shouldn't happen if conditions are right
            else a[i] = lo + rand()%(hi - lo + 1);
        }
        
        // Run solution logic
        bool ok = true;
        for(int i = 1; i < n; i++) if(a[i] > a[i-1]) ok = false;
        if(ok) for(int i = 0; i < n; i++) if(a[i] < n-i-1 || a[i] > n) ok = false;
        if(!ok) continue;
        
        map<int,int> cnt;
        for(int i = 0; i < n; i++) cnt[a[i]]++;
        set<int> free_vals;
        for(int v = 0; v <= n; v++) if(!cnt.count(v) || cnt[v]==0) free_vals.insert(v);
        
        priority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> mand;
        for(int i = 1; i < n; i++){
            if(a[i] < a[i-1]){
                for(int v = a[i]+1; v < a[i-1]; v++) mand.push({i-1, v});
            }
        }
        for(int v = 0; v < a[n-1]; v++) mand.push({n-1, v});
        
        set<int> present, added_mand;
        vector<int> b(n);
        bool fail = false;
        
        for(int i = 0; i < n; i++){
            bool need_new = (i==0) ? (a[0]==n) : (a[i]==a[i-1]);
            if(need_new){
                bool found = false;
                while(!mand.empty()){
                    int dl = mand.top().first, v = mand.top().second;
                    if(added_mand.count(v) || present.count(v)){ mand.pop(); continue; }
                    if(v >= a[i]) break;
                    mand.pop();
                    b[i] = v; present.insert(v); added_mand.insert(v); free_vals.erase(v);
                    found = true; break;
                }
                if(!found){
                    auto it = free_vals.begin();
                    while(it != free_vals.end() && *it < a[i]){
                        if(!present.count(*it)){
                            b[i] = *it; present.insert(*it); free_vals.erase(it); found = true; break;
                        }
                        ++it;
                    }
                    if(!found){ fail = true; break; }
                }
            } else {
                if(i==0){ b[i]=n; present.insert(n); free_vals.erase(n); }
                else { b[i]=a[i-1]; present.insert(a[i-1]); free_vals.erase(a[i-1]); }
            }
            cnt[a[i]]--;
            if(cnt[a[i]]==0){ cnt.erase(a[i]); if(!present.count(a[i])&&a[i]<=n) free_vals.insert(a[i]); }
        }
        
        if(fail) continue; // some valid a might still produce NO? shouldn't happen for our generated ones
        
        // Verify
        tests++;
        bool valid = true;
        for(int i = 0; i < n; i++){
            int k = n - i;
            int got = compute_kmex(b, i+1, k);
            if(got != a[i]){ valid = false; break; }
        }
        if(valid) pass++;
        else {
            printf("FAIL: n=%d a=[",n);
            for(int i=0;i<n;i++) printf("%d ",a[i]);
            printf("] b=[");
            for(int i=0;i<n;i++) printf("%d ",b[i]);
            printf("]\n");
            // Show details
            for(int i=0;i<n;i++){
                int k=n-i;
                printf("  step %d: k=%d kmex=%d expected=%d\n",i+1,k,compute_kmex(b,i+1,k),a[i]);
            }
            if(tests-pass > 10) break;
        }
    }
    printf("Stress test: %d/%d passed\n", pass, tests);
}
