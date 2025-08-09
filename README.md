Async Travel Itinerary API (Cloudflare Worker + D1 + ChatGPT)
A serverless API that:

Accepts a destination & duration

Immediately returns a jobId (202 Accepted)

Generates a travel itinerary asynchronously using ChatGPT

Persists results in Cloudflare D1 (SQLite-based database)

Allows polling for status/result (GET /api/itineraries/:id)

📂 Project Structure
bash
Copy
Edit
.
├── src/
│   └── worker.js         # Cloudflare Worker source code
├── migrations/
│   └── 0001_init.sql     # D1 table schema
├── wrangler.toml         # Cloudflare config
└── README.md             # This file
🛠 Prerequisites
Cloudflare account with Workers & D1 enabled

Node.js v18+ installed locally

Wrangler CLI installed:

bash
Copy
Edit
npm install -g wrangler
OpenAI API key with active quota or billing
Sign up: https://platform.openai.com

🚀 Setup Steps
1) Clone & Install
bash
Copy
Edit
git clone <your-repo-url>
cd <your-repo-folder>
npm install
2) Create D1 Database
bash
Copy
Edit
# Create D1 instance
wrangler d1 create travel-db
This will output:

ini
Copy
Edit
[[d1_databases]]
binding = "DB"
database_name = "travel-db"
database_id = "<SOME-ID>"
Copy that into your wrangler.toml under the same section.

3) Apply Migration
The migrations/0001_init.sql file contains:

sql
Copy
Edit
CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  destination TEXT NOT NULL,
  durationDays INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  itinerary_json TEXT,
  error TEXT
);
Apply it remotely:

bash
Copy
Edit
wrangler d1 migrations apply travel-db --remote
4) Set Your OpenAI API Key
bash
Copy
Edit
wrangler secret put OPENAI_API_KEY
Paste your full key (starts with sk-... or sk-proj-...) when prompted.

Tip: To verify your key works before storing it:

bash
Copy
Edit
export OPENAI_API_KEY="sk-..."
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
Should return a JSON list of models, not an error.

5) (Optional) Enable Mock Mode for Quota Failures
If you have no billing/quota but still want working results for demo/testing:

In wrangler.toml add:

toml
Copy
Edit
[vars]
USE_MOCK_IF_QUOTA = "1"
This tells the Worker to return a generated placeholder itinerary if OpenAI returns 429 insufficient_quota.

6) Register Your workers.dev Subdomain
If you’ve never deployed a Worker before:

bash
Copy
Edit
wrangler deploy
You’ll be prompted:

vbnet
Copy
Edit
Would you like to register a workers.dev subdomain now? yes
What would you like your workers.dev subdomain to be? stak-itinerary-amir
Enter a name only (no https:// or .workers.dev).

7) Deploy
bash
Copy
Edit
wrangler deploy
Output:

nginx
Copy
Edit
Deployed successfully: https://travel-itineraries-worker.<subdomain>.workers.dev
📡 API Usage
Create an Itinerary Job
bash
Copy
Edit
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan","durationDays":5}' \
  https://travel-itineraries-worker.<subdomain>.workers.dev/api/itineraries
Response (202 Accepted):

json
Copy
Edit
{ "jobId": "8d2a2a56-9d7e-4d3f-9cbd-0d5e2d2c5f86" }
Poll for Status
bash
Copy
Edit
curl https://travel-itineraries-worker.<subdomain>.workers.dev/api/itineraries/8d2a2a56-9d7e-4d3f-9cbd-0d5e2d2c5f86
While processing:

json
Copy
Edit
{
  "status": "processing",
  "destination": "Tokyo, Japan",
  "durationDays": 5,
  "createdAt": "2025-08-09T15:30:12.345Z",
  "completedAt": null,
  "itinerary": null,
  "error": null
}
When done:

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
If failed:

json
Copy
Edit
{
  "status": "failed",
  "destination": "Tokyo, Japan",
  "durationDays": 5,
  "createdAt": "...",
  "completedAt": "...",
  "itinerary": null,
  "error": "OpenAI API error: 429 insufficient_quota"
}
🧩 Key Components
Async Processing: Uses ctx.waitUntil() to call OpenAI after responding to the client.

Persistence: Stores jobs in Cloudflare D1 with Firestore-like shape.

LLM Integration: Calls OpenAI’s Chat Completions API with response_format: json_schema.

CORS Support: Allows browser apps to call the API directly.

Mock Mode: Optional fake itinerary if quota exceeded.

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
Inspect Job Directly in DB
bash
Copy
Edit
wrangler d1 execute travel-db --remote \
  --command "SELECT * FROM itineraries WHERE id='<jobId>';"
📬 Submission / Sharing
When ready to share:

Deploy the Worker

Test it works end-to-end

Send the POST and GET example URLs in your email:

bash
Copy
Edit
POST: https://travel-itineraries-worker.<subdomain>.workers.dev/api/itineraries
GET:  https://travel-itineraries-worker.<subdomain>.workers.dev/api/itineraries/<jobId>
