// ============================================================
// n8n Code Node — "Extract Products with Category Info from Nhasachphuongnam HTML"
// ============================================================
// Input: HTML của trang category/product listing
// Output: Mỗi product là 1 item riêng với thông tin category
// Schema: product_urls | category_id | created_at | display_order |
//         description | category_image_url | is_active | name |
//         slug | category_url | parent_slug | parent_id
//
// NOTE: Nếu category không có sản phẩm, trả về empty array

const BASE_DOMAIN = 'https://nhasachphuongnam.com';
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

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract category info from breadcrumb and meta tags
function extractCategoryInfo(html) {
  const result = {
    categoryName: '',
    categorySlug: '',
    categoryUrl: '',
    parentName: '',
    parentSlug: '',
    displayOrder: 1,
  };
  
  // Get category name from og:title meta tag
  const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
  if (ogTitleMatch) {
    result.categoryName = decodeEntities(ogTitleMatch[1]);
    result.categorySlug = slugify(result.categoryName);
  }
  
  // Get category URL from canonical tag
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
  if (canonicalMatch) {
    result.categoryUrl = canonicalMatch[1];
  } else {
    result.categoryUrl = absoluteUrl('/collections/' + result.categorySlug);
  }
  
  // Get breadcrumb info for parent
  const breadcrumbItems = html.match(/<span itemprop="name">([^<]+)<\/span>/gi) || [];
  if (breadcrumbItems.length > 1) {
    const crumbs = breadcrumbItems
      .map(item => {
        const m = item.match(/>([^<]+)</);
        return m ? m[1].trim() : '';
      })
      .filter(Boolean);
    
    // Skip "Trang chủ" and get parent
    const filtered = crumbs.filter(c => c !== 'Trang chủ');
    if (filtered.length > 1) {
      result.parentName = filtered[1];
      result.parentSlug = slugify(result.parentName);
    }
    
    // Display order based on breadcrumb depth
    result.displayOrder = filtered.length;
  }
  
  return result;
}

// Extract product URLs from page - multiple methods
function extractProducts(html) {
  const products = new Set();
  const seenUrls = new Set();
  
  // Method 1: data-url attributes with /products/
  const dataUrls = html.match(/data-url=["']([^"']+)["']/gi) || [];
  for (const u of dataUrls) {
    const m = u.match(/data-url=["']([^"']+)["']/);
    if (m && m[1].includes('/products/')) {
      const cleanUrl = m[1].split('?')[0];
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        products.add(cleanUrl);
      }
    }
  }
  
  // Method 2: href to /products/
  const productLinks1 = html.match(/href=["']([^"']*\/products\/[^"']+)["']/gi) || [];
  for (const u of productLinks1) {
    const m = u.match(/href=["']([^"']+)["']/);
    if (m) {
      const url = m[1].split('?')[0].split('#')[0];
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        products.add(url);
      }
    }
  }
  
  // Method 3: href from product-card elements ( Cooponline pattern)
  const productCards = html.match(/product-card[^>]*>([\s\S]*?)<\/div>/gi) || [];
  for (const card of productCards) {
    // Get href link
    const linkMatch = card.match(/href=["']([^"']+)["']/);
    if (linkMatch) {
      let url = linkMatch[1].split('?')[0].split('#')[0];
      if (url.startsWith('/') && !seenUrls.has(url)) {
        seenUrls.add(url);
        products.add(url);
      }
    }
  }
  
  // Method 4: Extract from __NEXT_DATA__ if present
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Try to find products in pageProps
      const pageProps = nextData.props?.pageProps || nextData.props || {};
      const serverProducts = pageProps.serverProducts || pageProps.products || [];
      
      for (const product of serverProducts) {
        let url = '';
        if (product.link?.as?.pathname) {
          url = product.link.as.pathname;
        } else if (product.link?.href?.pathname) {
          url = product.link.href.pathname.replace('[sku]', product.sku);
        } else if (product.url) {
          url = product.url;
        } else if (product.slug) {
          url = '/products/' + product.slug;
        }
        
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          products.add(url);
        }
      }
    } catch (e) {
      console.log('[WARN] Error parsing __NEXT_DATA__:', e.message);
    }
  }
  
  return Array.from(products);
}

// Check if page is empty (no products) - ONLY check after finding products
// This prevents false positives from product content like "Hết hàng" status
function isEmptyCategory(html, foundProductsCount) {
  // Only check empty patterns if we found NO products
  // This prevents false positives from product content like "Hết hàng" status
  if (foundProductsCount > 0) {
    return false;
  }
  
  // If no products found, check for explicit empty messages
  const emptyPatterns = [
    'không có sản phẩm nào',
    'chưa có sản phẩm',
    'hiện không có sản phẩm',
    'no products in this',
    'no products available',
  ];
  
  for (const pattern of emptyPatterns) {
    if (html.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  return false;
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

// Extract category info
const categoryInfo = extractCategoryInfo(html);
console.log('Category:', categoryInfo.categoryName);
console.log('Category URL:', categoryInfo.categoryUrl);
console.log('Parent:', categoryInfo.parentName || '(root)');
console.log('Display Order:', categoryInfo.displayOrder);

// Extract product URLs
const productUrls = extractProducts(html);
console.log('Products found:', productUrls.length);

// Check if it's an empty category (after extract)
if (isEmptyCategory(html, productUrls.length)) {
  console.log('[INFO] Category khong co san pham - tra ve empty array');
  return [];
}

// Nếu không có sản phẩm, trả về empty array thay vì throw error
if (productUrls.length === 0) {
  console.log('[WARN] Khong tim thay product URLs - tra ve empty array');
  return [];
}

// For each product, create an output item
const result = productUrls.map((productUrl, index) => {
  const cleanUrl = productUrl.replace(BASE_DOMAIN, '');
  const productSlug = cleanUrl.replace('/products/', '').replace(/^\//, '').split('?')[0];
  
  return {
    product_urls: absoluteUrl(productUrl),
    category_id: index + 1,
    created_at: now,
    display_order: categoryInfo.displayOrder,
    description: '',
    category_image_url: '',
    is_active: true,
    name: '',
    slug: productSlug,
    category_url: categoryInfo.categoryUrl,
    parent_slug: categoryInfo.parentSlug,
    parent_id: null,
  };
});

console.log('\nOutput items:', result.length);
console.log('\nSample:');
result.slice(0, 3).forEach(r => {
  console.log(`- ${r.product_urls}`);
  console.log(`  slug: ${r.slug}`);
  console.log(`  category_url: ${r.category_url}`);
});

return result.map(r => ({ json: r }));
