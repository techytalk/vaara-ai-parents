# Home suggestions: read, don’t join

**Status:** implemented. Deploy API for server enforcement, then publish a
production OTA for the Home label and Mute hide.

## Product rule

When a parent's own circles are quiet, Home may show a conversation from a
circle they are not in.

The Home card represents one conversation. Opening it shows only that thread:
the message and its replies. It does not open the circle.

The parent cannot use that thread to browse the circle's Feed, members, other
threads, or unrelated posts.

Reading a suggestion does not join the circle or create a guest-access grant.

## Suggested versus Guest

Someone else's conversation from a circle the parent is not in is labeled:

**Suggested · Slate the school**

The parent can read that thread and report inappropriate content. They cannot:

- reply
- like or add another reaction
- message the author from that thread
- edit or delete messages
- mute the thread
- open the circle

A question the parent wrote in a circle they are not in is different. It is
labeled:

**Guest · Slate the school**

The guest author can read and reply in their own thread. Existing guest-author
access remains unchanged. Messages inbox keeps this Guest label for the
parent's own question.

A conversation from a circle the parent belongs to has neither label and
continues to open the group normally.

## Server enforcement

On a Suggested (discovery) thread the API:

- rejects replies (`canReply` is false)
- rejects likes and reactions
- rejects message-author (`canMessageAuthor` is false)
- rejects mute
- allows read of the thread and report

Hiding buttons in the phone is not enough; the routes above enforce the same
rules.

## Same content in more than one circle

Membership wins.

If one post is sent to Gaudium and Slate, and the parent belongs to Gaudium,
they see it through Gaudium and retain normal member access. It is not also
shown as a read-only Slate suggestion.

## Posts and shared links

Home suggests conversation threads, not post cards. Post comments are outside
this feature. The unused `suggested=1` post-query path was removed.

A non-member opening a normal post continues to see only the post preview. A
shared link also continues to show only the post preview.

The circle page **Feed** tab remains circle-specific. It does not fill itself
with posts from other circles.

## Checklist (done)

- Discovery Home cards say **Suggested**.
- Own guest-authored threads keep **Guest** in Messages.
- Suggested card opens by thread ID, not circle ID.
- Thread is read-only: no reply, reaction, message-author, edit, delete, or Mute.
- Report stays available.
- API enforces the same restrictions.
- Unused `suggested=1` post path removed.
- Member, guest-author, and shared-link behavior preserved.
- Discovery Home fill excludes the viewer's own threads and threads they
  already have a guest grant on (those stay under Messages as Guest).
