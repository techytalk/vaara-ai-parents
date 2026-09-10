-- Signup places a parent by school, board and class without asking for a child
-- nickname. Nickname is filled later from the in-app tour / prompts.
ALTER TABLE children
  ALTER COLUMN nickname DROP NOT NULL;
