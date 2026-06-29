const fs = require('fs');
const arr = JSON.parse(fs.readFileSync('c:/CollectionData/Data.txt', 'utf8'));
const html = arr[0].data;

// Check what the actual product title looks like in the HTML
const search1 = html.indexOf('8567546118293');
console.log('8567546118293 found at:', search1);

if (search1 >= 0) {
  // Show context around the product id
  console.log('\nContext around id:');
  console.log(html.substring(search1 - 20, search1 + 200));
}

// Also search for the title differently
const search2 = html.indexOf('Áo Bra');
console.log('\nÁo Bra found at:', search2);

if (search2 >= 0) {
  console.log('\nContext around title:');
  console.log(html.substring(search2 - 50, search2 + 200));
}

// Search for the product object differently - look for the title property
const search3 = html.indexOf('title":"Áo Bra');
console.log('\ntitle with Áo Bra found at:', search3);

if (search3 >= 0) {
  console.log('\nContext:');
  console.log(html.substring(search3 - 100, search3 + 100));
}
