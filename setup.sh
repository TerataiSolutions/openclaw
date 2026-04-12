#!/bin/bash
# Aether‑7 memory system setup script
# Run this after cloning the repository to configure the environment.

echo "Aether‑7 Memory System Setup"
echo "============================"

# 1. Check for required environment variables
for var in SUPABASE_URL SUPABASE_ANON_KEY COHERE_API_KEY COHERE_ENDPOINT; do
    if [ -z "${!var}" ]; then
        echo "⚠️  Missing environment variable: $var"
    else
        echo "✅ $var is set"
    fi
done

# 2. Install Node dependencies (if any)
if [ -f "package.json" ]; then
    npm install
fi

# 3. Run SQL setup (manual step reminder)
echo ""
echo "Next steps:"
echo "1. Open Supabase SQL Editor and run enable_vector_search.sql"
echo "2. Optionally run update_sql_threshold.sql to set default threshold to 0.25"
echo "3. Test the system: node semantic_search_enhanced.js 'proactive' 5"
echo ""
echo "Setup complete."