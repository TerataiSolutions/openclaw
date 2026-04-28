const { createClient } = require('@supabase/supabase-js');

let instance = null;

function getSupabaseClient() {
 if (!instance) {
 const url = process.env.SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

 if (!url || !key) {
 throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
 }

 instance = createClient(url, key);
 }
 return instance;
}

module.exports = { getSupabaseClient };
