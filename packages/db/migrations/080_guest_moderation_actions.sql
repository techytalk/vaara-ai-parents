-- Expand moderation audit actions for guest-question removal / restore.

ALTER TABLE admin_moderation_actions
  DROP CONSTRAINT IF EXISTS admin_moderation_actions_action_check;

ALTER TABLE admin_moderation_actions
  ADD CONSTRAINT admin_moderation_actions_action_check
  CHECK (action IN (
    'hide',
    'unhide',
    'block_posting',
    'unblock_posting',
    'remove_guest_question',
    'restore_guest_question'
  ));
