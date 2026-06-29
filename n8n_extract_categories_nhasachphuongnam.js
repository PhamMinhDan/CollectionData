// ============================================================
// n8n Code Node — "Extract Categories from Nhasachphuongnam Homepage HTML"
// ============================================================
// Input: mỗi item có field "data" chứa HTML thô của trang homepage
// Output: danh sách categories với hierarchy
// Schema: category_id | created_at | display_order | description |
//         category_image_url | is_active | name | slug |
//         category_url | parent_slug | parent_id

const BASE_DOMAIN = 'https://nhasachphuongnam.com';
const now = new Date().toISOString();

// ---------- Helpers ----------
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&copy;/g, '').replace(/&reg;/g, '').replace(/&deg;/g, '')
    .replace(/&hellip;/g, '...').replace(/&ndash;/g, '-').replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[àáâãảå]/g, 'a').replace(/[èéêẻẽ]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõỏ]/g, 'o')
    .replace(/[ùúûüủ]/g, 'u').replace(/[ỳýÿ]/g, 'y')
    .replace(/[đ]/g, 'd').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
    .replace(/[&]/g, 'and').replace(/[%]/g, '').replace(/[+]/g, '-plus')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function absoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return BASE_DOMAIN + (url.startsWith('/') ? url : '/' + url);
}

function extractLinks(html) {
  const results = [];
  const seen = new Set();
  const regex = /<a\s[^>]*href=["']([^"']*\/collections\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1].split('?')[0].split('#')[0];
    const text = decodeEntities(match[2]).trim();
    if (!href || !text || text.length < 2 || text.length > 100) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    results.push({ href, text });
  }
  return results;
}

function extractSubmenu(html) {
  const startIdx = html.indexOf('<div class="submenu">');
  if (startIdx < 0) return '';
  let depth = 0;
  for (let i = startIdx; i < html.length; i++) {
    if (html[i] === '<') {
      const rest = html.substring(i, i + 5).toLowerCase();
      if (rest.startsWith('<div') && html[i + 4] !== '/') {
        depth++;
        i += rest.length - 1;
      } else if (rest === '</div') {
        depth--;
        if (depth === 0) {
          return html.substring(startIdx + '<div class="submenu">'.length, i);
        }
      }
    }
  }
  return '';
}

// Extract li-sub2 with depth-aware parsing
function extractLiSub2(html) {
  const results = [];
  const tag = '<li class="li-sub2">';
  let pos = 0;
  
  while (true) {
    const startIdx = html.indexOf(tag, pos);
    if (startIdx < 0) break;
    
    let liDepth = 1;
    let ulDepth = 0;
    let searchFrom = startIdx + tag.length;
    let endIdx = -1;
    
    for (let i = searchFrom; i < html.length && liDepth > 0; i++) {
      const remaining = html.substring(i);
      
      if (remaining.startsWith('<ul')) {
        ulDepth++;
        while (i < html.length && html[i] !== '>') i++;
        continue;
      }
      
      if (remaining.startsWith('</ul>')) {
        ulDepth--;
        i += 5;
        continue;
      }
      
      if (remaining.startsWith('<li ')) {
        if (ulDepth === 0) liDepth++;
        i += 3;
        continue;
      }
      
      if (remaining.startsWith('</li>')) {
        if (ulDepth === 0) {
          liDepth--;
          if (liDepth === 0) {
            endIdx = i + 5;
            break;
          }
        }
        i += 5;
        continue;
      }
    }
    
    if (endIdx < 0) break;
    results.push(html.substring(startIdx, endIdx));
    pos = endIdx;
  }
  
  return results;
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
const allCategories = [];

// ---------- Parse Level 1 (menu-item) ----------
let searchPos = 0;
const menuStart = 'class="menu-item has-submenu"';

while (true) {
  const startIdx = html.indexOf(menuStart, searchPos);
  if (startIdx < 0) break;
  
  // Find submenu and closing </li>
  const submenuStart = html.indexOf('<div class="submenu">', startIdx);
  if (submenuStart < 0) { searchPos = startIdx + 1; continue; }
  
  let depth = 0;
  let submenuEnd = -1;
  for (let i = submenuStart; i < html.length; i++) {
    if (html[i] === '<') {
      const rest = html.substring(i, i + 5).toLowerCase();
      if (rest.startsWith('<div') && html[i + 4] !== '/') {
        depth++;
        i += rest.length - 1;
      } else if (rest === '</div') {
        depth--;
        if (depth === 0) { submenuEnd = i + 6; break; }
      }
    }
  }
  
  if (submenuEnd < 0) { searchPos = startIdx + 1; continue; }
  
  const closingLi = html.indexOf('</li>', submenuEnd);
  if (closingLi < 0) { searchPos = startIdx + 1; continue; }
  
  const endIdx = closingLi + 5;
  const liHtml = html.substring(startIdx, endIdx);
  
  // Get level 1 name and href
  const level1Match = liHtml.match(/<a class="menu-link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!level1Match) { searchPos = endIdx; continue; }
  
  const level1Href = level1Match[1].split('?')[0].split('#')[0];
  const level1Text = level1Match[2];
  
  const altMatch = level1Text.match(/alt=["']([^"']+)["']/i);
  let level1Name = altMatch ? decodeEntities(altMatch[1]) : '';
  if (!level1Name) {
    level1Name = decodeEntities(level1Text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  
  if (!level1Name || level1Name.length < 2 || !level1Href.includes('/collections/')) {
    searchPos = endIdx; continue;
  }
  
  const level1Slug = slugify(level1Name);
  allCategories.push({ name: level1Name, href: level1Href, slug: level1Slug, level: 1, parentSlug: '' });
  
  // ---------- Parse Level 2 & 3 ----------
  const submenuHtml = extractSubmenu(liHtml);
  const liSub2Items = extractLiSub2(submenuHtml);
  
  for (const liSub2Html of liSub2Items) {
    const linkMatch = liSub2Html.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    
    const level2Href = linkMatch[1].split('?')[0].split('#')[0];
    const level2TextRaw = linkMatch[2];
    const level2Name = decodeEntities(level2TextRaw.replace(/<i[^>]*>.*?<\/i>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    
    if (!level2Name || level2Name.length < 2 || !level2Href.includes('/collections/')) continue;
    
    const level2Slug = slugify(level2Name);
    allCategories.push({ name: level2Name, href: level2Href, slug: level2Slug, level: 2, parentSlug: level1Slug });
    
    // Level 3 from ul-sub3
    const ulSub3Match = liSub2Html.match(/<ul class="ul-sub3">([\s\S]*?)<\/ul>/i);
    if (ulSub3Match) {
      const level3Links = extractLinks(ulSub3Match[1]);
      for (const link of level3Links) {
        allCategories.push({ name: link.text, href: link.href, slug: slugify(link.text), level: 3, parentSlug: level2Slug });
      }
    }
  }
  
  searchPos = endIdx;
}

// ---------- Deduplicate ----------
const seen = new Set();
const deduped = allCategories.filter(cat => {
  const key = cat.slug + '|' + cat.level;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// ---------- Build output rows ----------
const slugToId = new Map();
let nextId = 1;

// Level 1 first, then level 2+
for (const cat of deduped.filter(c => c.level === 1)) {
  slugToId.set(cat.slug, nextId);
  nextId++;
}
for (const cat of deduped.filter(c => c.level > 1)) {
  slugToId.set(cat.slug, nextId);
  nextId++;
}

// Final output
const result = deduped.map(cat => {
  const category_id = slugToId.get(cat.slug);
  const parentId = cat.parentSlug ? (slugToId.get(cat.parentSlug) ?? null) : null;
  
  return {
    category_id,
    created_at: now,
    display_order: cat.level,
    description: '',
    category_image_url: '',
    is_active: true,
    name: cat.name,
    slug: cat.slug,
    category_url: absoluteUrl(cat.href),
    parent_slug: cat.parentSlug || '',
    parent_id: parentId,
  };
});

result.sort((a, b) => a.category_id - b.category_id);

// ---------- Summary ----------
const summary = {};
for (const r of result) {
  summary[r.display_order] = (summary[r.display_order] || 0) + 1;
}
console.log('Total categories:', result.length);
console.log('By level:', JSON.stringify(summary));

return result.map(r => ({ json: r }));
