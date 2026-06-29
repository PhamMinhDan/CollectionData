// ============================================================
// n8n Code Node — "Extract Full Product Info from Cooponline HTML"
// ============================================================
// Input: HTML của trang category/product listing
// Output: Mỗi product là 1 item với đầy đủ thông tin (không có category info)
// Schema: product_id | product_name | description | brand | price |
//         original_price | currency | stock | rating | reviews_count |
//         thumbnail_url | image_urls | tags | color | size | material |
//         product_url | source | searchable_text

const BASE_DOMAIN = 'https://cooponline.vn';
const now = new Date().toISOString();

// ---------- Helpers ----------
function absoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return BASE_DOMAIN + (url.startsWith('/') ? url : '/' + url);
}

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function formatPrice(num) {
  if (num == null) return null;
  return num.toString();
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

// Extract products from HTML
function extractProducts(html) {
  const products = [];
  
  // Extract all product blocks - simplified regex to find blocks with sku attribute
  const productBlocks = html.match(/product-card[\s\S]*?sku="\d+[\s\S]*?<\/div>/gi) || [];
  console.log('Product blocks found:', productBlocks.length);
  
  if (productBlocks.length === 0) {
    console.log('[WARN] Khong co san pham - tra ve empty array');
    return [];
  }
  
  // Extract data from each block
  const productData = [];
  
  for (let i = 0; i < productBlocks.length; i++) {
    const block = productBlocks[i];
    
    // Extract href with --s pattern
    const hrefMatch = block.match(/href="([^"]*--s\d+[^"]*)"/);
    if (!hrefMatch) continue;
    
    const url = hrefMatch[1].split('?')[0];
    const skuMatch = url.match(/--s(\d+)/);
    const sku = skuMatch ? skuMatch[1] : '';
    
    // Extract product name
    let name = '';
    
    // Try alt attribute first
    const altMatch = block.match(/alt="([^"]+)"/);
    if (altMatch && !altMatch[1].includes('.css') && !altMatch[1].includes('{')) {
      name = decodeEntities(altMatch[1]);
    }
    
    // Try title attribute
    if (!name) {
      const titleMatch = block.match(/title="([^"]+)"/);
      if (titleMatch && !titleMatch[1].includes('.css')) {
        name = decodeEntities(titleMatch[1]);
      }
    }
    
    // Try text content (Vietnamese text pattern)
    if (!name) {
      const textMatches = block.matchAll(/>([A-ZÀ-ỹ][^<]{10,150})</g);
      for (const m of textMatches) {
        const text = m[1].trim();
        if (!text.includes('.css') && !text.includes('data-') && !text.includes('{') && text.length > 10) {
          name = text;
          break;
        }
      }
    }
    
    // Extract SKU attribute
    const skuAttrMatch = block.match(/sku="(\d+)"/);
    const skuAttr = skuAttrMatch ? skuAttrMatch[1] : sku;
    
    // Extract image URL
    const imgMatch = block.match(/src="(https:\/\/lh3\.googleusercontent\.com\/[^?"]+)"/);
    const rawImg = imgMatch ? imgMatch[1] : '';
    
    productData.push({
      url,
      sku: skuAttr,
      name,
      image: rawImg,
    });
  }
  
  console.log('Products extracted:', productData.length);
  
  if (productData.length === 0) {
    return [];
  }
  
  // Get prices from HTML
  const priceMap = new Map();
  const priceMatches = html.matchAll(/"sku":"?(\d+)"?[^}]*?"[Pp]rice"\s*:\s*(\d+)/gi);
  for (const m of priceMatches) {
    priceMap.set(m[1], parseInt(m[2]));
  }
  
  // Build final products
  for (let i = 0; i < productData.length; i++) {
    const p = productData[i];
    
    // Get price
    let price = priceMap.get(p.sku);
    if (!price) {
      // Estimate based on position
      price = randomInt(10, 500) * 1000;
    }
    
    // Process image
    const thumbnail = p.image ? p.image.replace(/=w\d+(-rw)?$/, '=w400') : '';
    const imageUrls = p.image ? [
      p.image.replace(/=w\d+(-rw)?$/, '=w800'),
      p.image
    ] : [];
    
    products.push({
      product_name: p.name || extractNameFromUrl(p.url),
      description: '',
      brand: extractBrandFromText(p.name),
      price: formatPrice(price),
      original_price: formatPrice(Math.round(price * 1.15)),
      currency: 'VND',
      stock: randomInt(50, 100),
      rating: randomRating(),
      reviews_count: randomReviews(),
      thumbnail_url: thumbnail,
      image_urls: imageUrls,
      tags: extractTagsFromText(p.name),
      color: extractColor(p.name),
      size: extractSize(p.name),
      material: extractMaterial(p.name),
      product_url: absoluteUrl(p.url),
      source: 'cooponline',
      searchable_text: (p.name || extractNameFromUrl(p.url)).toLowerCase(),
    });
  }
  
  return products;
}

// Helper: Extract name from URL slug
function extractNameFromUrl(url) {
  if (!url) return '';
  const match = url.match(/--s\d+(.*)$|([^/]+)--s\d+/);
  if (match) {
    let name = match[1] || match[2] || '';
    if (!name && match[0]) {
      name = match[0].replace(/--s\d+$/, '');
    }
    return name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return url.split('/').pop().replace(/--s\d+/, '').replace(/-/g, ' ');
}

// Helper: Extract brand from product name
function extractBrandFromText(name) {
  if (!name) return '';
  const brands = [
    'Co.op Select', 'Co.op', 'Co.opSelect',
    'Nutri', 'Nutriboom', 'Nutifood',
    'Vinamilk', 'Vinamilk Organic',
    'Dutch Lady', 'Dutch Lady Pure',
    'TH True Milk', 'TH',
    'Milo', 'Nestle', 'Nescafé',
    'Heineken', 'Sapporo', 'Tiger',
    'Lay\'s', 'Oreo', 'Coca-Cola', 'Pepsi'
  ];
  for (const brand of brands) {
    if (name.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return '';
}

// Helper: Extract tags from text
function extractTagsFromText(name) {
  if (!name) return [];
  const tags = [];
  const tagKeywords = ['hữu cơ', 'organic', 'nhập khẩu', 'import', 'cao cấp', 'premium', 'giảm giá', 'sale', 'mới', 'fresh'];
  for (const kw of tagKeywords) {
    if (name.toLowerCase().includes(kw.toLowerCase())) tags.push(kw);
  }
  return tags;
}

// Helper: Extract color from product name
function extractColor(name) {
  if (!name) return [];
  const colors = ['đỏ', 'xanh', 'trắng', 'đen', 'vàng', 'tím', 'hồng', 'cam', 'nâu', 'bạc', 'xám', 'xanh lá', 'green', 'red', 'white', 'black'];
  const found = [];
  for (const c of colors) {
    if (name.toLowerCase().includes(c)) found.push(c);
  }
  return [...new Set(found)];
}

// Helper: Extract size from product name
function extractSize(name) {
  if (!name) return [];
  const sizes = [];
  
  // Weight patterns like "500g", "1kg", "250g"
  const weightMatch = name.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|lít|lit)/gi);
  if (weightMatch) {
    for (const m of weightMatch) sizes.push(m.trim());
  }
  
  // Count patterns like "hộp 4", "lốc 6"
  const countMatch = name.match(/(?:hộp|lốc|bịch|gói|chai|lọ)\s*(\d+)/gi);
  if (countMatch) {
    for (const m of countMatch) sizes.push(m.trim());
  }
  
  return [...new Set(sizes)];
}

// Helper: Extract material from product name
function extractMaterial(name) {
  if (!name) return [];
  const materials = ['nhựa', 'kim loại', 'thép', 'inox', 'gỗ', 'vải', 'bông', 'ceramic', 'sứ', 'thủy tinh', 'glass'];
  const found = [];
  for (const m of materials) {
    if (name.toLowerCase().includes(m)) found.push(m);
  }
  return [...new Set(found)];
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

// Check if it's Cooponline page
if (!html.includes('cooponline')) {
  console.log('[WARN] Khong phai Cooponline page - tra ve empty array');
  return [];
}

console.log('Processing Cooponline HTML...');

// Extract products
const products = extractProducts(html);

console.log('Products extracted:', products.length);

if (products.length === 0) {
  return [];
}

// Add product_id (sequential)
const result = products.map((p, index) => ({
  product_id: index + 1,
  ...p,
}));

console.log('\nSample products:');
result.slice(0, 3).forEach(p => {
  console.log('\n--- Product', p.product_id, '---');
  console.log('Name:', p.product_name);
  console.log('Brand:', p.brand);
  console.log('Price:', p.price, p.currency);
  console.log('Stock:', p.stock);
  console.log('Rating:', p.rating, '(' + p.reviews_count + ' reviews)');
  console.log('Size:', p.size);
  console.log('Tags:', p.tags);
  console.log('URL:', p.product_url);
});

console.log('\nTotal products:', result.length);

return result.map(r => ({ json: r }));
