Re Scrap website PIHPS ini di buat untuk mengoptimalkan proses pengambilan data harga bahan pangan dengan lebih efisien. This project is a modern web application designed to scrape, store, analyze, and visualize food commodity price data from Indonesia's PIHPS (Price Information Center for Food Crops and Horticulture).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Dashboard Analytics](#dashboard-analytics)
- [Performance Optimizations](#performance-optimizations)
- [Contributing](#contributing)
- [License](#license)

## Overview

PIHPS Re-Scrap is a comprehensive data collection and analytics platform that:
- Scrapes food commodity price data from PIHPS API
- Stores data in Excel format with metadata management
- Provides interactive dashboard with visual analytics
- Supports multiple wilayah (regional) comparisons
- Offers AI-powered insights and forecasting

## Architecture

### System Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Flask Backend │────▶│  PIHPS API      │
│  (HTML/JS)      │     │   (Python)      │     │  (External)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Chart.js       │     │  Storage System │
│  Visualization  │     │  (Excel + JSON) │
└─────────────────┘     └─────────────────┘
```

### Data Flow
1. **Scraping**: User selects parameters (provinsi, kab/kota, komoditas, date range)
2. **Processing**: Backend fetches data from PIHPS API asynchronously
3. **Storage**: Data saved as Excel files with JSON metadata
4. **Analytics**: Dashboard loads data for visualization and analysis

## Project Structure

```
pihps_dashboard/
├── app.py                    # Main Flask application
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── tailwind.config.js        # Tailwind CSS configuration
├── static/
│   ├── css/                  # Stylesheets
│   ├── js/
│   │   └── app.js            # Main JavaScript application
│   ├── img/                  # Images and assets
│   └── storage/              # Data storage directory
│       └── metadata.json     # Storage metadata
├── templates/
│   ├── base.html             # Base template
│   ├── index.html            # Main page
│   └── tabs/
│       ├── scrape.html       # Scraping interface
│       ├── storage.html      # Data storage management
│       └── dashboard.html    # Analytics dashboard
└── .windsurf/                # IDE configuration
```

## Features

### 1. Data Scraping
- **Multi-region support**: Scrape multiple provinces and cities simultaneously
- **Multiple commodities**: Select multiple food commodities in one job
- **Date range selection**: Flexible start and end dates
- **Asynchronous processing**: Background job execution with progress tracking
- **Resume capability**: Auto-save to storage without downloading

### 2. Data Storage
- **Excel format**: Data stored in .xlsx format for easy analysis
- **Metadata management**: JSON-based metadata for file tracking
- **File browser**: View, download, and delete stored files
- **Preview capability**: Preview data before loading to dashboard

### 3. Dashboard Analytics

#### Executive Summary
- **Top 3 Gainers**: Commodities with highest price increases
- **Top 3 Losers**: Commodities with highest price decreases
- **Price comparison**: First vs last period with percentage change
- **Location indicators**: National level data with "Nasional" badge

#### Trend Analysis (Tren Historis & Volatilitas)
- **Multi-wilayah comparison**: Compare trends across multiple regions
- **Interactive selection**: Checkbox-based wilayah selection
- **Dynamic legend**: Color-coded regions with legend
- **Time-series visualization**: Historical price trends with Chart.js

#### Regional Disparity (Disparitas Antar Wilayah)
- **Correlation matrix**: Price differences between regions
- **Percentage comparison**: Color-coded disparity indicators
- **Hover tooltips**: Detailed price information on hover

#### Price Distribution
- **Bar chart visualization**: Price distribution across regions
- **Average price line**: Reference line for average prices

#### Forecasting (Proyeksi Harga)
- **Linear regression**: Simple time-series forecasting
- **Multi-wilayah forecast**: Projections for multiple regions
- **Dashed line indicators**: Visual distinction between historical and forecast
- **Adjustable periods**: Configurable forecast periods

### 4. AI Chat Assistant
- **Gemini API integration**: AI-powered insights and Q&A
- **Context-aware responses**: Based on current dashboard data
- **Food security analysis**: Expert-level analysis capabilities

## Technology Stack

### Backend
- **Python 3.x**: Core programming language
- **Flask**: Web framework for API and routing
- **Pandas**: Data manipulation and Excel processing
- **OpenPyXL**: Excel file read/write
- **Requests**: HTTP client for PIHPS API

### Frontend
- **HTML5**: Semantic markup
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Interactive charting library
- **Font Awesome**: Icon library
- **Vanilla JavaScript**: No framework dependency

### External APIs
- **PIHPS API**: Data source for food commodity prices
- **Gemini API**: AI chat and analysis (optional)

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/rohisrachman/PIHPS-Re-Srap.git
   cd PIHPS-Re-Srap
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables** (optional)
   ```bash
   export GEMINI_API_KEY="your_gemini_api_key"  # Optional for AI features
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Access the application**
   Open browser and navigate to `http://localhost:5000`

## Usage

### Scraping Data

1. Navigate to the "Scrape" tab
2. Select provinces (Provinsi) from dropdown
3. Recommended cities (Kab/Kota) will appear - select as needed
4. Choose commodities (Komoditas)
5. Set date range (Start Date - End Date)
6. Click "Start Scraping"
7. Monitor progress in real-time
8. Save to storage when complete

### Managing Storage

1. Go to "Storage" tab
2. View all stored files with metadata
3. Preview data before loading
4. Download Excel files
5. Delete unwanted files

### Dashboard Analytics

1. Select "Dashboard" tab
2. Choose file from storage dropdown
3. Wait for data to load
4. Interact with charts:
   - Select commodities from dropdown
   - Check/uncheck wilayah for comparison
   - Hover for detailed information

## API Endpoints

### Reference Data
- `GET /api/ref/provinsi` - List all provinces
- `GET /api/ref/komoditas` - List all commodities
- `GET /api/ref/regency/<province_id>` - List cities by province
- `GET /api/recommend/regency/<province_id>` - Get recommended cities

### Scraping Operations
- `POST /api/start` - Start new scraping job
- `GET /api/status/<job_id>` - Get job status
- `POST /api/cancel/<job_id>` - Cancel running job
- `GET /api/download/<job_id>` - Download Excel file
- `POST /api/jobs/<job_id>/save` - Save to storage

### Storage Management
- `GET /api/storage/list` - List all stored files
- `GET /api/storage/download/<file_id>` - Download stored file
- `POST /api/storage/delete/<file_id>` - Delete file
- `POST /api/storage/clear` - Clear all storage
- `GET /api/storage/preview/<file_id>` - Preview file data

### Dashboard & Analytics
- `GET /api/dashboard/stats` - Get dashboard statistics
- `POST /api/dashboard/data` - Get processed dashboard data
- `POST /api/ai/chat` - AI chat endpoint

## Dashboard Analytics

### Data Format
The dashboard expects data in pivot format:
- **Columns**: Time periods (e.g., "Apr 2020 (I)", "Apr 2020 (II)")
- **Rows**: Commodities with NAME column for regional data
- **Values**: Price values

### Key Metrics Calculated
- **Price Change %**: ((Last - First) / First) × 100
- **Correlation Matrix**: Price differences between regions
- **Forecast**: Linear regression projections

### Performance Features
- **Debounce (300ms)**: Prevents excessive re-renders
- **Animation disabled**: Smooth performance with large datasets
- **Span gaps**: Handles missing data points gracefully
- **Checkbox-based selection**: Quick wilayah comparison

## Performance Optimizations

### Frontend Optimizations
1. **Debounced updates**: 300ms delay for chart updates
2. **Animation disabled**: Chart.js animations turned off for performance
3. **Span gaps**: Connects lines across null values
4. **Lazy loading disabled**: Direct rendering to prevent canvas conflicts
5. **Null checks**: Robust handling of missing DOM elements

### Data Processing
1. **Pivot format handling**: Efficient time-series data parsing
2. **Level filtering**: National (0), Province (1), City (2) separation
3. **Price normalization**: Consistent number parsing with comma handling

### Chart.js Optimizations
1. **Max ticks limit**: 10 labels on x-axis for readability
2. **Font size optimization**: Smaller fonts for dense information
3. **Legend positioning**: Top-mounted legends for space efficiency
4. **Grid styling**: Subtle grid lines with reduced opacity

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source. Feel free to use, modify, and distribute.

## Acknowledgments

- **PIHPS (Pusat Informasi Harga Pangan Hortikultura Secara Nasional)** for providing the data API
- **Chart.js** for the excellent visualization library
- **Tailwind CSS** for the utility-first styling framework
- **Flask** for the lightweight and powerful web framework

---

**Developed with ❤️ for better food price data analytics in Indonesia**
