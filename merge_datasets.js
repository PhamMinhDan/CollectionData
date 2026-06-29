// ============================================================
// Script merge all CSV files - PROPER CSV PARSING
// Handles quoted fields with commas correctly
// ============================================================
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const baseDir = 'c:/CollectionData/Dataset';
const outputDir = 'c:/CollectionData';

const files = [
  { file: 'Dataset DATN - Dataset - Concung.csv', source: 'concung' },
  { file: 'Dataset DATN - Dataset - Emart.csv', source: 'emart' },
  { file: 'Dataset DATN - Dataset - Guardian.csv', source: 'guardian' },
  { file: 'Dataset DATN - Dataset - NhaSachPhuongNam.csv', source: 'nhasachphuongnam' },
  { file: 'Dataset DATN - Dataset - SuperSports.csv', source: 'supersports' },
  { file: 'Dataset DATN - Dataset - Tiki.csv', source: 'tiki' },
  { file: 'Ecommerce Dataset - Dataset - Canifa.csv', source: 'canifa' },
  { file: 'Ecommerce Dataset - Dataset - Hòa Phát.csv', source: 'hoaphat' },
  { file: 'Ecommerce Dataset - Dataset - Nội Thất.csv', source: 'noithat' },
  { file: 'Ecommerce Dataset - Dataset - Nhà Xinh.csv', source: 'nhaxinh' },
  { file: 'Ecommerce Dataset - Dataset - TGDD.csv', source: 'tgdd' },
  { file: 'Ecommerce Dataset - Dataset - Yody.csv', source: 'yody' },
];

// Header columns (in order)
const headers = [
  'product_id', 'product_name', 'description', 'category_name', 'category_slug',
  'category_url', 'category_image_url', 'brand', 'price', 'original_price',
  'currency', 'stock', 'rating', 'reviews_count', 'thumbnail_url', 'image_urls',
  'tags', 'color', 'size', 'material', 'product_url', 'source', 'searchable_text'
];
const HEADER_COUNT = 23;

// Proper CSV parser - handles quoted commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

// Escape CSV value
function escapeCSV(value) {
  if (value == null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Process single file
function processFile(filePath, source, startId) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let globalProductId = startId;
    let skipped = 0;
    
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    
    let lineNum = 0;
    
    rl.on('line', (line) => {
      lineNum++;
      
      // Skip header
      if (lineNum === 1) return;
      
      if (!line.trim()) return;
      
      const values = parseCSVLine(line);
      
      // Only process if we have reasonable columns
      if (values.length < 5) {
        skipped++;
        return;
      }
      
      // Pad with empty if needed
      while (values.length < HEADER_COUNT) {
        values.push('');
      }
      
      // Take only first 23 columns
      const limited = values.slice(0, HEADER_COUNT);
      
      // Update product_id
      limited[0] = globalProductId++;
      
      // Update source
      limited[21] = source;
      
      rows.push(limited);
    });
    
    rl.on('close', () => {
      if (skipped > 0) {
        console.log(`  ⚠️ Skipped ${skipped} invalid rows`);
      }
      resolve({ rows, newStartId: globalProductId });
    });
    rl.on('error', reject);
  });
}

// Main
async function main() {
  console.log('=== MERGING DATASETS (Proper CSV Parser) ===\n');
  
  let globalProductId = 1;
  const allRows = [headers];
  
  for (const { file, source } of files) {
    const filePath = path.join(baseDir, file);
    console.log(`Processing: ${file}`);
    
    try {
      const result = await processFile(filePath, source, globalProductId);
      allRows.push(...result.rows.map(r => r.map((v, i) => i === 0 ? v : escapeCSV(v)).join(',')));
      
      console.log(`  ✅ Processed ${result.rows.length} rows`);
      globalProductId = result.newStartId;
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
    }
  }
  
  // Write output with BOM
  const outputPath = path.join(outputDir, 'Merged_Ecommerce_Dataset.csv');
  const outputContent = allRows.join('\r\n');
  fs.writeFileSync(outputPath, '\ufeff' + outputContent, 'utf8');
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total files merged: ${files.length}`);
  console.log(`Total products: ${allRows.length - 1}`);
  console.log(`Output file: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
