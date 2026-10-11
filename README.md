# Panirakhandar – Smart Village Water Management
*Save Water Today. Sustain Farms Tomorrow.*

## Folder structure
```
panirakhandar/
├── index.html      Dashboard (home page)
├── stream.html     Stream Water Assessment
├── farmers.html    Farmer & Water Demand
├── ponds.html      Smart Pond Planning
├── planner.html    Summer Water Planner (allocation + weekly schedule)
├── style.css       Shared styles
├── app.js          Shared storage, calculations, navigation
├── README.md
└── images/
    ├── hero-fallback.svg   Illustrated hills / cane field / stream (included)
    └── hero.jpg            OPTIONAL: your own photo, picked up automatically
```
Keep all files in the same folder exactly as shown.

## Run it
Double-click `index.html` (Chrome or Edge recommended). No install or build step.
If your browser does not keep data between pages (some Firefox settings treat each local
file separately), run a tiny local server instead:
`python3 -m http.server 8000` inside the folder, then open http://localhost:8000

## Hero photo
Save any photo of green hills / a stream / sugarcane fields as `images/hero.jpg`.
The dark-green overlay keeps the text readable. Without it, the included illustration is shown.
(Use a photo you own or that has a free licence, e.g. your own village photo.)

## Quick manual test
1. Click **Load demo data** (top bar). Dashboard fills in; a yellow "Demonstration data" banner appears.
2. Stream page: switch Monsoon/Summer and Mode A/B, try a 0 or 120% value and read the error.
3. Farmers page: add a farmer, add two farms, edit one, delete one; change planning days.
4. Ponds page: change loss % and pond size; see count, shortfall/surplus update.
5. Planner page: change available water; change a farm's soil to Wet or rain to 30 mm and watch it be skipped.
6. Return to Dashboard: numbers match. Refresh the browser: data stays.
7. **Reset data** → confirm → everything is empty and shows "Data not entered yet".
