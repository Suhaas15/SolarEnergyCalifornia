# ☀️Solar Footprints — Interactive Visual Analytics of Solar Installations in California


A playful, powerful, and exploratory web app that turns 200k+ California solar installation records into an interactive story — complete with maps, time‑lapse animation, infrastructure overlays, and a friendly AI chatbot that answers questions like a domain expert.  

**Try the live demo:** https://solar-footprints.netlify.app/

---

## 🚀 Highlights
- Four coordinated D3.js visualizations (choropleth, time-series animation, infrastructure overlays, urban–rural chord diagram).  
- AI chatbot that accepts natural-language questions and updates visualizations.  
- Robust preprocessing pipeline in Python (dedupe, outlier removal, reverse geocoding).  
- Deployed and accessible online — built for planners, researchers, and curious citizens.

---

## 📄 Project report / paper
Full project report in this repo.

---

## 🧭 Quick Tour (what you’ll see)
1. **Land‑use choropleth** — quickly find counties dominated by residential, agricultural, industrial, or open‑space installations.  
2. **Time‑series animation** — watch California’s solar footprint grow year by year.  
3. **Infrastructure overlay** — plot transformers & transmission lines to assess grid readiness.  
4. **Urban–rural chord diagram** — visualize energy flow and regional interconnections.  
5. **AI Chatbot** — type "Which county grew fastest in 2016?" and the app highlights the answer.

---

## 🛠️ Run locally (dev)
```bash
# clone
git clone <this-repo-url>
cd <this-repo>

# install
npm install

# dev server
npm run dev       # or: npm start

# build for production
npm run build
```

**Notes**
- Data preprocessing was done in Python/pandas; preprocessed JSON/CSV are used by the frontend.  
- There are TopoJSON & GeoJSON assets for county boundaries and grid infrastructure inside `/data` (or `/public/data`) — make sure those paths are correct if you move files.

---

## 🧾 Data & provenance
- **Main dataset:** *Solar Footprints in California* (Data.gov) — 203,412 installation records (2010–2020).  
- **Infrastructure sources:** CAISO GIS & transformer datasets.  
- The preprocessing pipeline (dedupe, outlier filtering, reverse-geocoding) is described in the project report. fileciteturn0file0

---

## 🏗️ Architecture (super short)
- **Preprocess:** Python + pandas → clean, aggregate, produce JSON/CSV.  
- **Frontend:** Modular ES6 + D3.js modules, bundled with Webpack. Central state via D3 dispatchers.  
- **Chatbot:** Template-based matching (JSON templates) mapped to D3 filters; integrated into UI and synchronized with views.  
- **Deploy:** Static web host (Netlify) serving HTML/CSS/JS + static data assets.

---

## 🎨 Design notes
- Color palettes chosen for clear land‑use separation and accessibility.  
- Animation uses `requestAnimationFrame` for smooth playback.  
- Tooltips and legends provide contextual meta-data and unit conversions.

---

## ✅ Evaluation & impact
Pilot study with domain experts showed:
- ~25% faster task completion vs. static reports.  
- High satisfaction for the chatbot’s usability (especially among non-technical users).  
Results and detailed methodology are in the report. fileciteturn0file0

---

## 🧩 Want to extend this?
- Add economic overlays (incentives, cost estimates).  
- Add predictive models for adoption forecasting.  
- Add multi-user bookmarking / annotation for collaborative analysis.

---


Thanks for checking out my repo!☀️

