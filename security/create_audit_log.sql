CREATE TABLE IF NOT EXISTS audit_log (
 id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 event_type text NOT NULL,
 client_id text,
 memory_id uuid,
 action text NOT NULL,
 performed_at timestamptz DEFAULT now(),
 details jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_client_id_idx ON audit_log(client_id);
CREATE INDEX IF NOT EXISTS audit_log_performed_at_idx ON audit_log(performed_at);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log(event_type);