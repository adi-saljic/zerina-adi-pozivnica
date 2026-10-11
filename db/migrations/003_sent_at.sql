-- 003: when the couple sent a household its link. Set and cleared from /admin only;
-- the seed never writes it.

alter table invitations add column sent_at timestamptz null;
