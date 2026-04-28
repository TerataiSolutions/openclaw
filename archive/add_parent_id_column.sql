-- Add parent_id column to memories table for resolution linking
ALTER TABLE memories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES memories(id);
-- Add an index for faster resolution lookups
CREATE INDEX IF NOT EXISTS memories_parent_id_idx ON memories(parent_id);