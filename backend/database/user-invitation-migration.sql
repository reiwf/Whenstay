-- User Invitation System Migration
-- Extends user_profiles table to support email invitations

-- Add invitation-related columns to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN invitation_token VARCHAR(64) UNIQUE,
ADD COLUMN invitation_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN invited_by UUID REFERENCES user_profiles(id),
ADD COLUMN invitation_status VARCHAR(20) DEFAULT 'active';

-- Make first_name and last_name nullable for invitations
-- (Users can provide these during invitation acceptance)
ALTER TABLE user_profiles 
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL;

-- Add indexes for invitation lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_invitation_token 
ON user_profiles(invitation_token) 
WHERE invitation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_invitation_status 
ON user_profiles(invitation_status);

-- Add constraint for invitation_status values
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_invitation_status_check 
CHECK (invitation_status IN ('active', 'pending', 'accepted', 'expired'));

-- Add comment explaining the invitation flow
COMMENT ON COLUMN user_profiles.invitation_token IS 
'Secure token for email invitation links. NULL for regular users.';

COMMENT ON COLUMN user_profiles.invitation_expires_at IS 
'Expiration timestamp for invitation token. 24 hours from creation.';

COMMENT ON COLUMN user_profiles.invited_by IS 
'ID of the admin user who sent the invitation.';

COMMENT ON COLUMN user_profiles.invitation_status IS 
'Status: active (regular user), pending (invitation sent), accepted (invitation completed), expired (token expired)';
