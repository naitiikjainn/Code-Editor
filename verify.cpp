#include <bits/stdc++.h>
using namespace std;
int main(){
    int n = 6;
    int a[] = {6,6,6,4,3,3};
    int b[] = {5,0,1,6,4,2};
    for(int i = 0; i < n; i++){
        int k = n - i;
        set<int> vals;
        for(int j = 0; j <= i; j++) vals.insert(b[j]);
        int miss = 0;
        for(int v = 0; ; v++){
            if(vals.find(v) == vals.end()){
                miss++;
                if(miss == k){
                    printf("i=%d k=%d kmex=%d a=%d %s\n",i+1,k,v,a[i],v==a[i]?"OK":"FAIL");
                    break;
                }
            }
        }
    }
    printf("\nTest1:\n");
    int a1[] = {3,3,1}; int b1[] = {2,0,3};
    for(int i = 0; i < 3; i++){
        int k = 3 - i;
        set<int> vals;
        for(int j = 0; j <= i; j++) vals.insert(b1[j]);
        int miss = 0;
        for(int v = 0; ; v++){
            if(vals.find(v) == vals.end()){
                miss++;
                if(miss == k){
                    printf("i=%d k=%d kmex=%d a=%d %s\n",i+1,k,v,a1[i],v==a1[i]?"OK":"FAIL");
                    break;
                }
            }
        }
    }
}
