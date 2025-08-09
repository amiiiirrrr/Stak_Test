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

.
├── src/
│ └── worker.js # Cloudflare Worker source code
├── migrations/
│ └── 0001_init.sql # D1 table schema
├── wrangler.toml # Cloudflare config
└── README.md # This file

yaml
Copy
Edit

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
bash
Copy
Edit
git clone <your-repo-url>
cd <your-repo-folder>
npm install
2. Create D1 Database
bash
Copy
Edit
wrangler d1 create travel-db
Copy the output database_id and update your wrangler.toml:

toml
Copy
Edit
[[d1_databases]]
binding = "DB"
database_name = "travel-db"
database_id = "<YOUR_DATABASE_ID>"
3. Apply Migration
bash
Copy
Edit
wrangler d1 migrations apply travel-db --remote
4. Set Your OpenAI API Key
bash
Copy
Edit
wrangler secret put OPENAI_API_KEY
Paste your full key (starts with sk-... or sk-proj-...).

5. (Optional) Enable Mock Mode for Quota Failures
Add to wrangler.toml if you want placeholder results when quota is exceeded:

toml
Copy
Edit
[vars]
USE_MOCK_IF_QUOTA = "1"
6. Register Your workers.dev Subdomain
On first deploy:

bash
Copy
Edit
wrangler deploy
When prompted, choose a subdomain name (e.g., stak-itinerary-amir).

7. Deploy
bash
Copy
Edit
wrangler deploy
📡 API Usage
Create an Itinerary Job
bash
Copy
Edit
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan","durationDays":5}' \
  https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries
Response (202 Accepted):

json
Copy
Edit
{ "jobId": "8d2a2a56-9d7e-4d3f-9cbd-0d5e2d2c5f86" }
Poll for Status
bash
Copy
Edit
curl https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries/<jobId>
Possible states:

processing

completed

failed

Example when completed:

json
Copy
Edit
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
🧩 Key Features
Async Processing – uses ctx.waitUntil() to call OpenAI after responding to the client.

Persistence – stores jobs in Cloudflare D1 with Firestore-like shape.

LLM Integration – calls OpenAI’s Chat Completions API with response_format: json_schema.

CORS Support – API can be called from browser apps.

Mock Mode – optional placeholder itinerary if OpenAI quota is exceeded.

🔍 Debugging
See Worker Logs
bash
Copy
Edit
wrangler tail
Check D1 Table Exists
bash
Copy
Edit
wrangler d1 execute travel-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='itineraries';"
Inspect a Job
bash
Copy
Edit
wrangler d1 execute travel-db --remote \
  --command "SELECT * FROM itineraries WHERE id='<jobId>';"
📬 Sharing / Submission
Send these to your reviewer:

bash
Copy
Edit
POST: https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries
GET:  https://travel-itineraries-worker.<your-subdomain>.workers.dev/api/itineraries/<jobId>