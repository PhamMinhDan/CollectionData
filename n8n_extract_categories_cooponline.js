// ============================================================
// n8n Code Node — "Extract Categories from Cooponline Homepage HTML"
// ============================================================
// Input: mỗi item có field "data" chứa HTML thô của trang homepage
// Output: danh sách categories với hierarchy
// Schema: category_id | created_at | display_order | description |
//         category_image_url | is_active | name | slug |
//         category_url | parent_slug | parent_id

const BASE_DOMAIN = 'https://cooponline.vn';
const now = new Date().toISOString();

// ---------- Helpers ----------
function slugify(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[àáâãảå]/g, 'a')
    .replace(/[èéêẻẽ]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõỏ]/g, 'o')
    .replace(/[ùúûüủ]/g, 'u')
    .replace(/[ỳýÿ]/g, 'y')
    .replace(/[đ]/g, 'd')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[&]/g, 'and')
    .replace(/[%]/g, '')
    .replace(/[+]/g, '-plus')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function absoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return BASE_DOMAIN + (url.startsWith('/') ? url : '/' + url);
}

function extractSlug(href) {
  if (!href) return '';
  const match = href.match(/\/c\/([^?]+)/);
  return match ? match[1] : href.replace(/^\/|\/$/g, '');
}

// ============================================================
// MAIN
// ============================================================
const items = $input.all();
const htmlPages = items
  .map(it => it.json.data || it.json.html || it.json.body || '')
  .filter(Boolean);

if (htmlPages.length === 0) {
  throw new Error('Khong tim thay HTML trong input (can field "data", "html" hoac "body").');
}

const html = htmlPages[0];

// Extract __NEXT_DATA__
const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (!nextDataMatch) {
  throw new Error('Khong tim thay __NEXT_DATA__ trong HTML.');
}

const nextData = JSON.parse(nextDataMatch[1]);
const menu = nextData.props.pageProps.menu;

// Filter only LINK type items (categories)
const linkItems = menu.filter(m => m.linkType === 'LINK');
console.log('Total LINK items:', linkItems.length);

// Build items map with children array
const itemsMap = new Map();
for (const item of linkItems) {
  itemsMap.set(item.id, { ...item, children: [] });
}

// Build children references
for (const item of linkItems) {
  const parentId = item.parentId || '';
  if (parentId && itemsMap.has(parentId)) {
    const parent = itemsMap.get(parentId);
    const childItem = itemsMap.get(item.id);
    if (childItem) {
      parent.children.push(childItem);
    }
  }
}

// Get top-level items (those whose parentId is not in itemsMap)
const topLevel = [];
for (const item of linkItems) {
  const parentId = item.parentId || '';
  if (!parentId || !itemsMap.has(parentId)) {
    topLevel.push(itemsMap.get(item.id));
  }
}

// Flatten hierarchy with levels
const flatCategories = [];

function traverse(item, level, parentSlug) {
  const slug = extractSlug(item.href);
  if (!slug) return; // Skip items without valid slug
  
  flatCategories.push({
    id: item.id,
    name: item.name,
    slug,
    href: item.href,
    level,
    parentId: item.parentId || null,
    parentSlug,
  });
  
  // Traverse children
  for (const child of item.children || []) {
    traverse(child, level + 1, slug);
  }
}

// Start from top-level items
for (const item of topLevel) {
  traverse(item, 1, '');
}

console.log('Total categories:', flatCategories.length);

// Build slug -> id mapping
const slugToId = new Map();
let nextId = 1;

// First pass: assign IDs based on order in flatCategories
for (const cat of flatCategories) {
  slugToId.set(cat.slug, nextId);
  cat.category_id = nextId;
  nextId++;
}

// Second pass: set parent_id
for (const cat of flatCategories) {
  cat.parent_id = cat.parentSlug ? (slugToId.get(cat.parentSlug) ?? null) : null;
}

// Build final output
const result = flatCategories.map(cat => ({
  category_id: cat.category_id,
  created_at: now,
  display_order: cat.level,
  description: '',
  category_image_url: '',
  is_active: true,
  name: cat.name,
  slug: cat.slug,
  category_url: absoluteUrl(cat.href),
  parent_slug: cat.parentSlug || '',
  parent_id: cat.parent_id,
}));

// Sort by category_id
result.sort((a, b) => a.category_id - b.category_id);

// Summary
const summary = {};
for (const r of result) {
  summary[r.display_order] = (summary[r.display_order] || 0) + 1;
}
console.log('By level:', JSON.stringify(summary));

// Show sample
console.log('\nSample output:');
result.slice(0, 10).forEach(r => {
  console.log(`[${r.category_id}] L${r.display_order} | ${r.name} | parent: ${r.parent_slug || '(root)'}`);
});

return result.map(r => ({ json: r }));
