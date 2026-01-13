
fetch("https://codeforces.com/blog/entry/148390")
    .then(r => r.text())
    .then(t => console.log(t)) // dump full html
    .catch(console.error);
