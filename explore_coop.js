const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/CollectionData/Data.txt', 'utf8'));
const html = data[0].data;

// Extract NEXT_DATA
const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (!nextDataMatch) {
  console.log('No NEXT_DATA found');
  process.exit(1);
}

const nextData = JSON.parse(nextDataMatch[1]);
console.log('NEXT_DATA parsed successfully');

// Explore structure
const props = nextData.props;
console.log('Props keys:', Object.keys(props));

const pageProps = props.pageProps || {};
console.log('pageProps keys:', Object.keys(pageProps));

// Look for menu/categories
const menu = pageProps.menu;
console.log('\nMenu items:', menu ? menu.length : 0);

if (menu && menu.length > 0) {
  console.log('First menu item:', JSON.stringify(menu[0], null, 2));
}

// Look for mainMenu or headerMenu
const mainMenu = pageProps.mainMenu || pageProps.headerMenu || pageProps.categories;
console.log('\nmainMenu:', mainMenu ? 'found' : 'not found');

// Check for category tree
const categoryTree = pageProps.categoryTree || pageProps.categories || pageProps.menu;
if (categoryTree) {
  console.log('Category tree length:', Array.isArray(categoryTree) ? categoryTree.length : 'not array');
}
