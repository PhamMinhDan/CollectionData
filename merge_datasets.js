// ============================================================
// Script merge all CSV files into one dataset
// Handle quoted CSV properly
// ============================================================
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const baseDir = 'c:/CollectionData/Dataset';
const outputDir = 'c:/CollectionData';

// Source files
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

const headerCount = 23;
const headers = 'product_id,product_name,description,category_name,category_slug,category_url,category_image_url,brand,price,original_price,currency,stock,rating,reviews_count,thumbnail_url,image_urls,tags,color,size,material,product_url,source,searchable_text';

// Parse CSV line properly (handle quoted commas)
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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
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

function processFile(filePath, source, startId) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let globalProductId = startId;
    
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    
    rl.on('line', (line) => {
      if (isFirstLine) {
        isFirstLine = false;
        return;
      }
      
      if (line.trim()) {
        const values = parseCSVLine(line);
        
        // Pad with empty values if needed
        while (values.length < headerCount) {
          values.push('');
        }
        
        // Update product_id (column 0)
        values[0] = globalProductId++;
        
        // Update source (column 21)
        if (values.length > 21) {
          values[21] = source;
        }
        
        // Escape all values
        const escapedValues = values.map((v, i) => {
          if (i === 0) return v; // product_id no escape
          return escapeCSV(v);
        });
        
        rows.push(escapedValues.join(','));
      }
    });
    
    rl.on('close', () => resolve({ rows, newStartId: globalProductId }));
    rl.on('error', reject);
  });
}

async function main() {
  console.log('=== MERGING DATASETS ===\n');
  
  let globalProductId = 1;
  const allRows = [headers];
  
  for (const { file, source } of files) {
    const filePath = path.join(baseDir, file);
    console.log(`Processing: ${file}`);
    
    try {
      const result = await processFile(filePath, source, globalProductId);
      allRows.push(...result.rows);
      
      console.log(`  - Processed ${result.rows.length} rows`);
      globalProductId = result.newStartId;
    } catch (e) {
      console.log(`  - Error: ${e.message}`);
    }
  }
  
  // Write output with BOM for Excel UTF-8 compatibility
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
