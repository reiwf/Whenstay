-- Beds24 Authentication Table Migration
-- Stores access tokens, refresh tokens, and expiry information

CREATE TABLE IF NOT EXISTS public.beds24_auth (
    id SERIAL PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on expires_at for efficient expiry checks
CREATE INDEX IF NOT EXISTS idx_beds24_auth_expires_at ON public.beds24_auth (expires_at);

-- Add trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_beds24_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_beds24_auth_updated
    BEFORE UPDATE ON public.beds24_auth
    FOR EACH ROW EXECUTE FUNCTION update_beds24_auth_updated_at();

-- Insert initial refresh token from environment variable
-- Note: This should be updated with your actual refresh token
INSERT INTO public.beds24_auth (refresh_token, access_token, expires_at) 
VALUES (
    '0eTyA3r+f5LPyRpaoj/p9HEjy6XrQ81tXliLD2+rGI+dP+PAO8VY/CacG9kFNR0+TjPEkuPz7NOMD2eNfv3b7iMsZ0NxkBZE1ajj/IAb1E25b40P1V7I4B7aOwDwHh0Qaz5to3yG7b4UPFd7CQu4FxSksb+yu4+qfSkMn8LLgg8=',
    NULL,
    NOW()
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.beds24_auth IS 'Stores Beds24 API authentication tokens with automatic refresh capability';
COMMENT ON COLUMN public.beds24_auth.access_token IS '24-hour access token for Beds24 API calls';  
COMMENT ON COLUMN public.beds24_auth.refresh_token IS '30-day refresh token for generating new access tokens';
COMMENT ON COLUMN public.beds24_auth.expires_at IS 'Timestamp when the current access token expires';
