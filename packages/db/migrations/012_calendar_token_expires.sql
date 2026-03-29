-- Migration: Add token_expires_at column to google_calendar_connections
-- This column stores the ISO 8601 timestamp when the OAuth access_token expires.
-- Used by the token refresh flow to determine if a new token needs to be fetched
-- from Google's OAuth2 endpoint before making Calendar API calls.

ALTER TABLE google_calendar_connections ADD COLUMN token_expires_at TEXT;
