
fetch("http://localhost:5000/api/problems/codeforces/blog/148390")
    .then(r => r.json())
    .then(d => console.log(JSON.stringify(d, null, 2)))
    .catch(console.error);
