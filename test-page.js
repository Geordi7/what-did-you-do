// Fetch the page HTML and check it's what we expect
const res = await fetch('http://localhost:5173');
const html = await res.text();
console.log('=== HTML ===');
console.log(html);

// Check main.tsx is served
const res2 = await fetch('http://localhost:5173/src/main.tsx');
const main = await res2.text();
console.log('=== main.tsx (first 500 chars) ===');
console.log(main.slice(0, 500));