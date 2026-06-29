// ============================================================
// n8n Code Node — "Extract Full Product Info from Nhasachphuongnam HTML"
// ============================================================
// Input: HTML của trang product
// Output: Product info (không có category info)
// Schema: product_id | product_name | description | brand | price |
//         original_price | currency | stock | rating | reviews_count |
//         thumbnail_url | image_urls | tags | color | size | material |
//         product_url | source | searchable_text

const BASE_DOMAIN = 'https://nhasachphuongnam.com';
const now = new Date().toISOString();

// ---------- Helpers ----------
function absoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return BASE_DOMAIN + (url.startsWith('/') ? url : '/' + url);
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRating() {
  return (4 + Math.random()).toFixed(1);
}

function randomReviews() {
  return randomInt(5, 200);
}

function formatPrice(num) {
  if (num == null) return null;
  return num.toString();
}

// Helper: Extract tags from product
function extractTags(product) {
  const tags = [];
  if (product.tags) {
    if (Array.isArray(product.tags)) tags.push(...product.tags);
    else if (typeof product.tags === 'string') tags.push(...product.tags.split(','));
  }
  return [...new Set(tags.map(t => t.trim()).filter(Boolean))];
}

// Helper: Extract options (size, color, etc)
function extractOptions(product) {
  const options = { color: [], size: [], material: [] };
  
  if (product.options && Array.isArray(product.options)) {
    for (const opt of product.options) {
      const name = (opt.name || '').toLowerCase();
      const values = opt.values || [];
      
      if (name.includes('màu') || name.includes('color')) {
        options.color.push(...values);
      } else if (name.includes('size') || name.includes('size') || name.includes('khổ') || name.includes('size')) {
        options.size.push(...values);
      } else if (name.includes('chất') || name.includes('material')) {
        options.material.push(...values);
      } else {
        // Add all values to size if unknown
        options.size.push(...values);
      }
    }
  }
  
  // Also extract from variants
  if (product.variants && Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (variant.option1 && !options.color.includes(variant.option1)) options.size.push(variant.option1);
      if (variant.option2 && !options.color.includes(variant.option2)) options.size.push(variant.option2);
      if (variant.option3 && !options.color.includes(variant.option3)) options.size.push(variant.option3);
    }
  }
  
  return {
    color: [...new Set(options.color)].filter(v => v && v !== 'Default Title'),
    size: [...new Set(options.size)].filter(v => v && v !== 'Default Title'),
    material: [...new Set(options.material)].filter(Boolean),
  };
}

// Helper: Extract brand
function extractBrand(product) {
  if (product.vendor) return product.vendor;
  return '';
}

// Helper: Extract stock from variants
function extractStock(product) {
  if (product.variants && Array.isArray(product.variants)) {
    let totalStock = 0;
    for (const variant of product.variants) {
      if (variant.inventory_quantity > 0) {
        totalStock += variant.inventory_quantity;
      }
    }
    if (totalStock > 0) return totalStock;
  }
  // Random if not available
  return randomInt(50, 100);
}

// ============================================================
// MAIN
// ============================================================
const items = $input.all();
const htmlPages = items
  .map(it => it.json.data || it.json.html || it.json.body || '')
  .filter(Boolean);

if (htmlPages.length === 0) {
  console.log('[WARN] Khong co HTML trong input - tra ve empty array');
  return [];
}

const html = htmlPages[0];

// Check if it's nhasachphuongnam page
if (!html.includes('nhasachphuongnam')) {
  console.log('[WARN] Khong phai nhasachphuongnam page - tra ve empty array');
  return [];
}

// Extract window.productData
const productDataMatch = html.match(/window\.productData\s*=\s*(\{[\s\S]*?\});/);
if (!productDataMatch) {
  console.log('[WARN] Khong tim thay window.productData - tra ve empty array');
  return [];
}

let product;
try {
  product = JSON.parse(productDataMatch[1]);
} catch (e) {
  console.log('[WARN] Loi parse productData:', e.message);
  return [];
}

console.log('Product extracted:', product.title);

// Extract options
const options = extractOptions(product);

// Get stock
const stock = extractStock(product);

// Process images
const imageUrls = [];
if (product.images && Array.isArray(product.images)) {
  for (const img of product.images) {
    // Convert to larger size
    const largeImg = img.replace(/_compact/, '').replace(/\?.*$/, '');
    imageUrls.push(largeImg);
  }
}

const thumbnailUrl = imageUrls.length > 0 ? imageUrls[0] : '';

// Build result
const result = {
  product_id: 1,
  product_name: product.title || '',
  description: product.description ? stripHtml(product.description) : '',
  brand: extractBrand(product),
  price: formatPrice(product.price),
  original_price: formatPrice(product.compare_at_price),
  currency: 'VND',
  stock: stock,
  rating: randomRating(),
  reviews_count: randomReviews(),
  thumbnail_url: thumbnailUrl,
  image_urls: imageUrls,
  tags: extractTags(product),
  color: options.color,
  size: options.size,
  material: options.material,
  product_url: absoluteUrl(product.url || product.handle ? '/products/' + product.handle : ''),
  source: 'nhasachphuongnam',
  searchable_text: (product.title || '').toLowerCase() + ' ' + (product.type || '').toLowerCase() + ' ' + (product.vendor || '').toLowerCase(),
};

console.log('\n=== Product Output ===');
console.log(JSON.stringify(result, null, 2));

return [{ json: result }];
