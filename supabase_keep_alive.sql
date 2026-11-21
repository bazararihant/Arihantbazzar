-- =========================================================================
-- अरिहंत बाजार: Supabase Database 24/7 सुरू ठेवण्यासाठी Keep-Alive SQL Script
-- =========================================================================
-- ही स्क्रिप्ट Supabase Dashboard -> SQL Editor मध्ये जाऊन RUN करा.
-- हे pg_cron द्वारे दर 30 मिनिटांनी db_heartbeat टेबलमध्ये '.' भरून लगेच डिलीट करेल.
-- यामुळे Supabase चा डेटाबेस कधीही झोपणार (Pause होणार) नाही!
-- =========================================================================

-- 1. Heartbeat टेबल तयार करा (नसल्यास)
CREATE TABLE IF NOT EXISTS db_heartbeat (
  id SERIAL PRIMARY KEY,
  pulse VARCHAR(50) DEFAULT '.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Keep-alive pings ट्रॅकिंग टेबल तयार करा
CREATE TABLE IF NOT EXISTS keep_alive_pings (
  id INT PRIMARY KEY DEFAULT 1,
  service_name VARCHAR(100) DEFAULT 'render_backend',
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ping_count INT DEFAULT 1
);

-- 3. pg_cron एक्स्टेंशन सक्षम करा (Supabase मध्ये मोफत उपलब्ध असते)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- जुना क्रॉन जॉब असल्यास तो काढून टाका
SELECT cron.unschedule('keep-supabase-db-alive-heartbeat') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'keep-supabase-db-alive-heartbeat'
);

-- 4. दर 30 मिनिटांनी आपोआप डॉट ('.') इन्सर्ट करून लगेच डिलीट करणारा शेड्यूल जॉब
SELECT cron.schedule(
  'keep-supabase-db-alive-heartbeat',
  '*/30 * * * *',
  $$
    -- १. डॉट इन्सर्ट करा (डेटाबेसवर Write ॲक्टिव्हिटी होते)
    INSERT INTO db_heartbeat (pulse, created_at) VALUES ('.', NOW());

    -- २. सर्व जुने डॉट्स लगेच डिलीट करा (डेटाबेसवर Delete ॲक्टिव्हिटी होते आणि जागा भरत नाही)
    DELETE FROM db_heartbeat WHERE created_at < NOW() - INTERVAL '10 seconds';

    -- ३. शेवटची पिंग वेळ अपडेट करा
    INSERT INTO keep_alive_pings (id, service_name, last_ping, ping_count)
    VALUES (1, 'supabase_internal_cron', NOW(), 1)
    ON CONFLICT (id) DO UPDATE SET
      last_ping = NOW(),
      ping_count = keep_alive_pings.ping_count + 1;
  $$
);

-- 5. चाचणी: तात्काळ एक टेस्ट हार्टबीट रन करा
INSERT INTO db_heartbeat (pulse, created_at) VALUES ('.', NOW());
DELETE FROM db_heartbeat WHERE pulse = '.';

-- सर्व ॲक्टिव्ह क्रॉन जॉब्स तपासा
SELECT jobid, jobname, schedule, active FROM cron.job;
