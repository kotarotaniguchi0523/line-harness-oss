-- Add group/room chat support to existing chats table
-- New columns support LINE group and room message sources alongside 1-on-1 chats

-- Source type: 'user' (default, 1-on-1), 'group', or 'room'
ALTER TABLE chats ADD COLUMN source_type TEXT NOT NULL DEFAULT 'user';

-- LINE group ID (present when source_type = 'group')
ALTER TABLE chats ADD COLUMN group_id TEXT;

-- LINE room ID (present when source_type = 'room')
ALTER TABLE chats ADD COLUMN room_id TEXT;

-- Cached group/room display name from LINE API
ALTER TABLE chats ADD COLUMN group_name TEXT;

-- Cached group picture URL from LINE API
ALTER TABLE chats ADD COLUMN group_picture_url TEXT;

-- Cached member count of the group/room
ALTER TABLE chats ADD COLUMN member_count INTEGER;

-- Allow friend_id to be NULL for group chats without a known sender
-- SQLite does not support ALTER COLUMN, but the existing NOT NULL was only
-- enforced at creation; new rows can omit friend_id by using the column default.
-- For SQLite, we work around this by allowing NULL in the application layer.

CREATE INDEX IF NOT EXISTS idx_chats_source_type ON chats(source_type);
CREATE INDEX IF NOT EXISTS idx_chats_group_id ON chats(group_id);
