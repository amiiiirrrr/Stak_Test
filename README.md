# 🌏 Async Travel Itinerary API

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Database](https://img.shields.io/badge/Cloudflare-D1-8A2BE2)](https://developers.cloudflare.com/d1/)
[![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?logo=openai&logoColor=white)](https://platform.openai.com/)

A **serverless API** that:
- Accepts a travel `destination` & `durationDays`
- Immediately returns a unique `jobId` (`202 Accepted`)
- Generates a travel itinerary asynchronously using **ChatGPT**
- Persists results in **Cloudflare D1** (SQLite-based database)
- Allows polling for status/result (`GET /api/itineraries/:id`)

---

## 📂 Project Structure

├── src/

│ └── worker.js # Cloudflare Worker source code

├── migrations/

│ └── 0001_init.sql # D1 table schema

├── wrangler.toml # Cloudflare config

└── README.md


---

## 🛠 Prerequisites

- **Cloudflare account** with Workers & D1 enabled
- **Node.js** v18+ installed locally
- **Wrangler CLI** installed:
  ```bash
  npm install -g wrangler
OpenAI API key with active quota or billing
Sign up here: https://platform.openai.com

🚀 Setup Steps
1. Clone & Install

```bash
git clone https://github.com/amiiiirrrr/Stak_Test.git
cd Stak_Test
npm install
```

2. Create D1 Database
```bash
wrangler d1 create travel-db
```

Copy the output database_id and update your wrangler.toml:
```bash
[[d1_databases]]
binding = "DB"
database_name = "travel-db"
database_id = "<YOUR_DATABASE_ID>"
```

3. Apply Migration
```bash
wrangler d1 migrations apply travel-db --remote
```

4. Set Your OpenAI API Key
```bash
wrangler secret put OPENAI_API_KEY
```

Paste your full key (starts with sk-... or sk-proj-...).

5. (Optional) Enable Mock Mode for Quota Failures
Add to wrangler.toml if you want placeholder results when quota is exceeded:
```bash
[vars]
USE_MOCK_IF_QUOTA = "1"
```

6. Register Your workers.dev Subdomain On first deploy:
```bash
wrangler deploy
```
When prompted, choose a subdomain name (e.g., stak-itinerary-amir).

7. Deploy
```bash
wrangler deploy
```

📡 API Usage
Create an Itinerary Job
```bash
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan","durationDays":5}' \
  https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries
```
```bash
Response (202 Accepted):
{ "jobId": "8d2a2a56-9d7e-4d3f-9cbd-0d5e2d2c5f86" }
```

Poll for Status
```bash
curl https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries/<jobId>
```


Example when completed:
```bash
{
  "status": "completed",
  "destination": "Tokyo, Japan",
  "durationDays": 5,
  "createdAt": "2025-08-09T15:30:12.345Z",
  "completedAt": "2025-08-09T15:30:20.777Z",
  "itinerary": [
    { "day": 1, "theme": "Classic Tokyo", "activities": [ ... ] }
  ],
  "error": null
}
```


🔍 Debugging
See Worker Logs
```bash
wrangler tail
```

Check D1 Table Exists
```bash
wrangler d1 execute travel-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='itineraries';"
  ```

Inspect a Job
```bash
wrangler d1 execute travel-db --remote \
  --command "SELECT * FROM itineraries WHERE id='<jobId>';"
```

📬 Sharing / Submission
Send these to your reviewer:
```bash
POST: https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries
GET:  https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries/<jobId>
```