# Home suggestions: read, don’t join

**Status:** final product rule. The Home tap is implemented. The remaining
label, server enforcement, Mute visibility, and post-flag removal still need
implementation.

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
- open the circle

A question the parent wrote in a circle they are not in is different. It is
labeled:

**Guest · Slate the school**

The guest author can read and reply in their own thread. Existing guest-author
access remains unchanged.

A conversation from a circle the parent belongs to has neither label and
continues to open the group normally.

## Server enforcement

The server must enforce read-only access on a Suggested thread. Hiding buttons
in the phone application is not sufficient.

The server already rejects replies from discovery viewers. It must also reject
likes, reactions, and attempts to message the author from that Suggested
thread. Reporting remains available.

## Mute

Do not show **Mute** on a Suggested thread.

Mute controls reply notifications, but a discovery viewer does not follow the
thread and does not receive those notifications. It also does not remove the
card from Home. Showing Mute would therefore suggest behavior it does not
provide.

A separate **Hide suggestion** or **Not interested** action may be designed
later. It is not part of this change.

## Same content in more than one circle

Membership wins.

If one post is sent to Gaudium and Slate, and the parent belongs to Gaudium,
they see it through Gaudium and retain normal member access. It is not also
shown as a read-only Slate suggestion.

This behavior already exists.

## Posts and shared links

Home currently suggests conversation threads, not post cards. Post comments are
therefore outside this feature.

Remove the unused `suggested=1` post-query behavior. No application screen uses
it, and the server cannot use that client-provided flag as proof that Home
suggested a post.

A non-member opening a normal post continues to see only the post preview. A
shared link also continues to show only the post preview. Neither path gains
access to comments through this feature.

The circle page **Feed** tab remains circle-specific. It does not fill itself
with posts from other circles.

## Implementation checklist

- Change discovery Home cards from **Guest** to **Suggested**.
- Keep **Guest** for the parent's own guest-authored thread.
- Open a Suggested card by thread ID, never by circle ID.
- Show the thread and replies in read-only mode.
- Hide reply, reaction, message-author, edit, delete, and Mute controls.
- Keep Report available.
- Enforce the same restrictions in the API.
- Remove the unused `suggested=1` post-query path.
- Preserve normal member, guest-author, and shared-link behavior.
