# 🚀 Re-Scrap PIHPS: Advanced Food Price Analytics

**Re-Scrap PIHPS** is a high-performance web application engineered to optimize the collection, management, and analysis of food commodity price data from Indonesia's **PIHPS (Pusat Informasi Harga Pangan Strategis)**. 

By replacing manual data entry with an automated, asynchronous pipeline, this platform empowers stakeholders with real-time insights into market trends, price volatility, and regional disparities across Indonesia.

---

## 🌟 Key Features

### 1. Intelligent Data Scraping
* **Asynchronous Processing:** Run heavy scraping jobs in the background with real-time progress tracking.
* **Multi-Parameter Support:** Scrape multiple provinces, cities, and commodities in a single execution.
* **Resume & Auto-Save:** Jobs are automatically cached to prevent data loss during network interruptions.

### 2. Robust Storage & Management
* **Format Versatility:** Data is stored in structured **Excel (.xlsx)** files for easy external use.
* **Smart Metadata:** JSON-based tracking allows for rapid file browsing, previewing, and retrieval.
* **Integrated File Manager:** A built-in dashboard to download, view, or delete datasets.

### 3. Analytics & Visualization Dashboard
* **Trend Monitoring:** Interactive time-series charts using **Chart.js** to track historical fluctuations.
* **Regional Disparity:** Specialized tools to compare price gaps between different cities and provinces.
* **Market Indicators:** Automated calculation of "Top Gainers" and "Top Losers" to identify inflation spikes.
* **Predictive Forecasting:** Built-in linear regression models to project future price movements.

### 4. AI-Powered Insights
* **Gemini AI Integration:** An intelligent chat assistant that provides context-aware analysis of your current dashboard data.
* **Decision Support:** Get expert-level summaries on food security and market dynamics.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python, Flask, Pandas, OpenPyXL |
| **Frontend** | HTML5, Tailwind CSS, Vanilla JavaScript |
| **Visualization** | Chart.js, Font Awesome |
| **APIs** | PIHPS External API, Google Gemini API |

---

## 🏗️ Architecture & Data Flow

The system follows a modern decoupled architecture to ensure scalability:

1.  **Request:** User defines parameters (region, date, commodity) via the UI.
2.  **Extraction:** The Flask backend fetches data asynchronously from the PIHPS API.
3.  **Transformation:** Raw JSON responses are parsed and pivoted using Pandas.
4.  **Persistence:** Processed data is saved to the `/static/storage/` directory.
5.  **Visualization:** The frontend pulls the processed data to render interactive, debounced charts.

---

## 🚀 Getting Started

### Prerequisites
* Python 3.8+
* Pip (Python Package Manager)

### Installation
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/rohisrachman/PIHPS-Re-Srap.git
    cd PIHPS-Re-Srap
    ```
2.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Environment Setup (Optional)**
    ```bash
    # For AI features
    export GEMINI_API_KEY="your_api_key_here" 
    ```
4.  **Launch the App**
    ```bash
    python app.py
    ```
    Access the UI at `http://localhost:5000`.

---

## 📈 Performance & Optimization

* **Debounced Rendering:** Chart updates are delayed by 300ms to ensure smooth performance during heavy interactions.
* **Optimized Charting:** Animations are disabled for large datasets to prevent browser lag.
* **Memory Efficiency:** Uses streaming for file downloads and efficient pivot tables for data processing.

---

## 🤝 Contributing

We welcome contributions! 
1. **Fork** the project.
2. **Create** your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4. **Push** to the branch (`git push origin feature/AmazingFeature`).
5. **Open** a Pull Request.

---

**Developed with ❤️ by Rohis Rachman**
*Empowering Indonesia through better food price data transparency.*