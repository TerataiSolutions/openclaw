#!/usr/bin/env python3
import os
import json
import requests
import sys

# Cohere embedding
text = "Webhook integration test - AOF Phase 2 complete."
cohere_key = os.environ.get("COHERE_API_KEY")
if not cohere_key:
    print("COHERE_API_KEY not set")
    sys.exit(1)

cohere_url = os.environ.get("COHERE_ENDPOINT", "https://api.cohere.ai/v1/embed")
headers = {
    "Authorization": f"Bearer {cohere_key}",
    "Content-Type": "application/json"
}
payload = {
    "texts": [text],
    "model": "embed-english-v3.0",
    "input_type": "search_document"
}
resp = requests.post(cohere_url, headers=headers, json=payload)
if resp.status_code != 200:
    print(f"Cohere error: {resp.status_code} {resp.text}")
    sys.exit(1)
embedding = resp.json()["embeddings"][0]

# Supabase store
supabase_url = os.environ.get("SUPABASE_URL")
anon_key = os.environ.get("SUPABASE_ANON_KEY")
if not supabase_url or not anon_key:
    print("Supabase credentials missing")
    sys.exit(1)

memory_payload = {
    "type": "conversation",
    "content": text,
    "embedding": embedding,
    "importance": 5,
    "tags": []
}
store_url = f"{supabase_url}/rest/v1/memories"
store_headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}
store_resp = requests.post(store_url, headers=store_headers, json=memory_payload)
if store_resp.status_code >= 200 and store_resp.status_code < 300:
    print("Memory stored successfully")
    sys.exit(0)
else:
    print(f"Supabase error: {store_resp.status_code} {store_resp.text}")
    sys.exit(1)