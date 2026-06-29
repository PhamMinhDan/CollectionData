// ============================================================
// n8n Code Node — "Extract Products with Category Info from Cooponline HTML"
// ============================================================
// Input: HTML của trang category/product listing
// Output: Mỗi product là 1 item riêng với thông tin category
// Schema: product_urls | category_id | created_at | display_order |
//         description | category_image_url | is_active | name |
//         slug | category_url | parent_slug | parent_id
//
// NOTE: Nếu category không có sản phẩm, trả về empty array

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

// Try to extract from __NEXT_DATA__
const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);

let serverProducts = [];
let seoInfo = {};
let categoryInfo = { level1: null, level2: null, level3: null };

if (nextDataMatch) {
  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData.props.pageProps || {};
    
    serverProducts = pageProps.serverProducts || [];
    seoInfo = pageProps.seoInfo || {};
    
    // Get category from first product
    if (serverProducts.length > 0) {
      const firstProduct = serverProducts[0];
      const productCategories = firstProduct.categories || [];
      
      for (let i = 0; i < productCategories.length; i++) {
        const cat = productCategories[i];
        if (i === 0) categoryInfo.level1 = cat;
        else if (i === 1) categoryInfo.level2 = cat;
        else if (i === 2) categoryInfo.level3 = cat;
      }
    }
  } catch (e) {
    console.log('[WARN] Loi parse __NEXT_DATA__:', e.message);
  }
}

// If no products from NEXT_DATA, try product-card method
if (serverProducts.length === 0) {
  console.log('[INFO] Khong tim thay products trong __NEXT_DATA__, thu method product-card');
  
  const productCards = html.match(/product-card[^>]*>([\s\S]*?)<\/div>/gi) || [];
  console.log('Product cards found:', productCards.length);
  
  if (productCards.length === 0) {
    console.log('[WARN] Khong co san pham - tra ve empty array');
    return [];
  }
  
  // Extract products from product-card elements
  const productSet = new Set();
  
  for (const card of productCards) {
    // Get href link
    const linkMatch = card.match(/href=["']([^"']+)["']/);
    if (linkMatch && linkMatch[1].startsWith('/')) {
      productSet.add(linkMatch[1]);
    }
    
    // Get data-content-name (sku)
    const skuMatch = card.match(/data-content-name=["']([^"']+)["']/);
    if (skuMatch) {
      // Build URL from sku
      const sku = skuMatch[1];
      const nameMatch = card.match(/>([^<]+)<\/a>|<span[^>]*>([^<]+)<\/span>/gi);
      let name = '';
      if (nameMatch) {
        const m = nameMatch[0].match(/>([^<]+)</);
        if (m) name = m[1].trim();
      }
      const productSlug = name ? slugify(name) + '--s' + sku : '--s' + sku;
      productSet.add('/' + productSlug);
    }
  }
  
  console.log('Products from product-card:', productSet.size);
  
  if (productSet.size === 0) {
    console.log('[WARN] Khong tim thay product URLs - tra ve empty array');
    return [];
  }
  
  // Build output
  const categoryUrl = seoInfo.canonical 
    ? absoluteUrl(seoInfo.canonical) 
    : absoluteUrl('/c/' + slugify(categoryInfo.level1?.name || 'unknown'));
  
  const displayOrder = categoryInfo.level3 ? 3 : categoryInfo.level2 ? 2 : 1;
  
  const result = Array.from(productSet).map((url, index) => {
    const slug = url.replace(/^\//, '');
    const parentSlug = categoryInfo.level1 ? slugify(categoryInfo.level1.name) : '';
    
    return {
      product_urls: absoluteUrl(url),
      category_id: index + 1,
      created_at: now,
      display_order: displayOrder,
      description: '',
      category_image_url: '',
      is_active: true,
      name: '',
      slug: slug,
      category_url: categoryUrl,
      parent_slug: parentSlug,
      parent_id: null,
    };
  });
  
  console.log('\nCategory:', categoryInfo.level1?.name || 'Unknown');
  console.log('Category URL:', categoryUrl);
  console.log('Products:', result.length);
  
  return result.map(r => ({ json: r }));
}

// Has products from NEXT_DATA
const categoryUrl = seoInfo.canonical 
  ? absoluteUrl(seoInfo.canonical) 
  : absoluteUrl('/c/' + slugify(categoryInfo.level1?.name || 'unknown'));

const displayOrder = categoryInfo.level3 ? 3 : categoryInfo.level2 ? 2 : 1;

const result = serverProducts.map((product, index) => {
  let productUrl = '';
  if (product.link && product.link.as && product.link.as.pathname) {
    productUrl = absoluteUrl(product.link.as.pathname);
  } else if (product.sku) {
    productUrl = absoluteUrl('/products/' + product.sku);
  } else {
    productUrl = absoluteUrl('/products/' + product.sku);
  }
  
  const slug = productUrl.replace(BASE_DOMAIN, '').replace(/^\//, '');
  
  return {
    product_urls: productUrl,
    category_id: index + 1,
    created_at: now,
    display_order: displayOrder,
    description: '',
    category_image_url: product.imageUrl || '',
    is_active: true,
    name: product.name || '',
    slug: slug,
    category_url: categoryUrl,
    parent_slug: categoryInfo.level1 ? slugify(categoryInfo.level1.name) : '',
    parent_id: null,
  };
});

console.log('\nCategory:', categoryInfo.level1?.name || 'Unknown');
console.log('Category URL:', categoryUrl);
console.log('Display Order:', displayOrder);
console.log('Products:', result.length);

console.log('\nSample:');
result.slice(0, 3).forEach(r => {
  console.log(`- ${r.product_urls}`);
  console.log(`  name: ${r.name}`);
});

return result.map(r => ({ json: r }));
