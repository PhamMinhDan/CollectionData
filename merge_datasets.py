# Script merge all CSV files - Using Pandas for proper CSV handling
import pandas as pd
import os
import warnings
warnings.filterwarnings('ignore')

base_dir = 'c:/CollectionData/Dataset'
output_dir = 'c:/CollectionData'

files = [
    ('Dataset DATN - Dataset - Concung.csv', 'concung'),
    ('Dataset DATN - Dataset - Emart.csv', 'emart'),
    ('Dataset DATN - Dataset - Guardian.csv', 'guardian'),
    ('Dataset DATN - Dataset - NhaSachPhuongNam.csv', 'nhasachphuongnam'),
    ('Dataset DATN - Dataset - SuperSports.csv', 'supersports'),
    ('Dataset DATN - Dataset - Tiki.csv', 'tiki'),
    ('Ecommerce Dataset - Dataset - Canifa.csv', 'canifa'),
    ('Ecommerce Dataset - Dataset - Hòa Phát.csv', 'hoaphat'),
    ('Ecommerce Dataset - Dataset - Nội Thất.csv', 'noithat'),
    ('Ecommerce Dataset - Dataset - Nhà Xinh.csv', 'nhaxinh'),
    ('Ecommerce Dataset - Dataset - TGDD.csv', 'tgdd'),
    ('Ecommerce Dataset - Dataset - Yody.csv', 'yody'),
]

# Define expected columns
columns = [
    'product_id', 'product_name', 'description', 'category_name', 'category_slug',
    'category_url', 'category_image_url', 'brand', 'price', 'original_price',
    'currency', 'stock', 'rating', 'reviews_count', 'thumbnail_url', 'image_urls',
    'tags', 'color', 'size', 'material', 'product_url', 'source', 'searchable_text'
]

print('=== MERGING DATASETS (Pandas) ===\n')

all_dfs = []

for file, source in files:
    file_path = os.path.join(base_dir, file)
    print(f'Processing: {file}')
    
    try:
        # Try different encodings and parsing options
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                # Use python engine for more flexible parsing
                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    engine='python',
                    on_bad_lines='skip',
                    quotechar='"',
                    escapechar='\\'
                )
                break
            except:
                continue
        
        # Check if we got columns
        if df.shape[1] < 5:
            print(f'  ⚠️ Skipped - not enough columns ({df.shape[1]})')
            continue
        
        # Rename columns if needed
        if df.shape[1] >= 23:
            df = df.iloc[:, :23]
        
        # Ensure we have 23 columns
        while df.shape[1] < 23:
            df[f'col_{df.shape[1]}'] = ''
        
        df = df.iloc[:, :23]
        df.columns = columns
        
        # Update source
        df['source'] = source
        
        # Add to list
        all_dfs.append(df)
        print(f'  ✅ Processed {len(df)} rows')
        
    except Exception as e:
        print(f'  ❌ Error: {str(e)[:50]}')

# Concatenate all dataframes
if all_dfs:
    merged_df = pd.concat(all_dfs, ignore_index=True)
    
    # Reset product_id
    merged_df['product_id'] = range(1, len(merged_df) + 1)
    
    # Save
    output_path = os.path.join(output_dir, 'Merged_Ecommerce_Dataset.csv')
    merged_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print('\n=== SUMMARY ===')
    print(f'Total files merged: {len(all_dfs)}')
    print(f'Total products: {len(merged_df):,}')
    print(f'Output file: {output_path}')
    print(f'File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB')
else:
    print('❌ No data to merge!')
