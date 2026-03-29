-- Yahoo Ads support: add yclid (Yahoo Click ID) column to ref_tracking
-- Used by both Yahoo Search Ads and Yahoo Display Ads (YDA) conversion tracking.

ALTER TABLE ref_tracking ADD COLUMN yclid TEXT;
