// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');

const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };