-- itineraries table mirrors your Firestore-like shape
CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,                 -- jobId (UUID)
  status TEXT NOT NULL,                -- 'processing' | 'completed' | 'failed'
  destination TEXT NOT NULL,
  durationDays INTEGER NOT NULL,
  createdAt TEXT NOT NULL,             -- ISO string (acts like Firestore Timestamp here)
  completedAt TEXT,                    -- ISO string or NULL
  itinerary_json TEXT,                 -- JSON array for 'itinerary'
  error TEXT                           -- error message or NULL
);

-- helpful index
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON itineraries(status);
CREATE INDEX IF NOT EXISTS idx_itineraries_createdAt ON itineraries(createdAt);
