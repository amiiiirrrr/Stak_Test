curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan","durationDays":5}' \
  https://travel-itineraries-worker.stak-itinerary-amir.workers.dev/api/itineraries
