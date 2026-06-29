# 📊 Ecommerce Dataset Visualization - Google Colab

## Hướng dẫn sử dụng Notebook trên Google Colab

### Bước 1: Mở Google Colab
1. Truy cập https://colab.research.google.com
2. Đăng nhập với tài khoản Google của bạn

### Bước 2: Upload Notebook
1. Click **File** → **Upload notebook**
2. Chọn file `Ecommerce_Visualization.ipynb` đã tải về

### Bước 3: Upload Dataset
1. Sau khi notebook mở, click vào **File** → **Upload to session storage**
2. Upload file `Merged_Ecommerce_Dataset.csv`

### Bước 4: Chạy từng Cell
1. Click **Runtime** → **Run all** (hoặc chạy từng cell bằng Shift+Enter)

### Các bước trong Notebook:

| Cell | Mô tả |
|------|--------|
| 1 | Markdown - Tiêu đề |
| 2 | Cài đặt thư viện |
| 3 | Import thư viện |
| 4 | Upload và đọc dataset |
| 5 | Thông tin dataset |
| 6 | Sample data |
| 7-8 | Sản phẩm theo nguồn (Bar + Pie) |
| 9-10 | Phân bố giá |
| 11-12 | Categories analysis |
| 13-15 | Brands, Stock, Rating |
| 16-17 | Data quality |
| 18-20 | Interactive Plotly charts |
| 21-22 | Download charts |

---

## Các chart được tạo:

1. **01_products_by_source.png** - Bar chart sản phẩm theo nguồn
2. **02_market_share_pie.png** - Pie chart thị phần
3. **03_price_distribution.png** - Box plot phân bố giá
4. **04_category_heatmap.png** - Heatmap categories
5. **05_avg_price.png** - Giá trung bình theo nguồn
6. **06_stock_distribution.png** - Phân bố stock
7. **07_top_brands.png** - Top 20 thương hiệu
8. **08_rating_distribution.png** - Phân bố rating
9. **09_data_quality.png** - Độ hoàn thiện dữ liệu

## Interactive Charts (HTML):
10. **10_interactive_products.html** - Tương tác: Products
11. **11_interactive_treemap.html** - Treemap categories
12. **12_summary_dashboard.html** - Dashboard tổng hợp

---

## Nếu Colab bị lỗi RAM:

```python
# Thêm cell này để giảm bộ nhớ
import gc
gc.collect()

# Hoặc đọc chỉ một phần dataset
df = pd.read_csv('Merged_Ecommerce_Dataset.csv', nrows=10000)
```
