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
7. **Reset data** → confirm → everything is empty and shows "Data not entered yet".## Project Overview

Panirakhandar is a smart village water management website designed to help farming communities estimate water availability, understand irrigation demand, and plan water storage for summer.

## Key Features

- **Dashboard:** Overview of the water management system.
- **Stream Water Assessment:** Estimate water availability using stream measurements.
- **Farmers & Water Demand:** Estimate irrigation requirements based on farm area and crop-water assumptions.
- **Smart Pond Planning:** Estimate storage requirements and pond capacity.
- **Summer Water Planner:** Plan water allocation and weekly irrigation schedules.

## Technology Stack

- HTML
- CSS
- JavaScript
- AWS Amplify (website hosting)

## Live Demo

Visit the deployed website:

https://production.d22lhtzum9d6a3.amplifyapp.com

## How to Use

1. Open the live website.
2. Enter stream measurements in the Stream Water Assessment section.
3. Add farm and crop information to estimate water demand.
4. Use Smart Pond Planning to estimate storage requirements.
5. Explore the Summer Water Planner for irrigation allocation.

## Limitations

The estimates depend on user-entered measurements and assumptions. Actual water availability, irrigation requirements, and pond designs must be verified using field measurements and appropriate technical guidance.

## Project Objective

To explore how a simple web application can support water planning and help farming communities make more informed decisions about water management.
