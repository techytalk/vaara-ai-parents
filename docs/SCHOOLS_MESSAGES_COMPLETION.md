# Schools and Messages completion

## Schools

The Schools tab opens with schools relevant to the signed-in parent's location.
Nearby means an exact pin-code match first, followed by schools in the same
city. It does not mean a city-wide parent feed and it does not expose a
parent's location to other users.

School list responses include the review count and the public aggregate rating.
The aggregate remains hidden until at least three visible reviews exist.
Discover ordering prioritizes location relevance; Reviews ordering is performed
by the API using the complete returned result set. The mobile client must not
fetch individual profiles to populate list ratings.

Search remains scoped by the parent's pin or city when either is available.
An empty query loads nearby schools, while typed search is debounced. If no
usable location exists, the UI asks the parent to complete their location.

School fees remain absent from school cards and profiles. Parents may mention
fees in free-form review text, but Vaara does not present that prose as
authoritative or structured fee information.

## Parent messaging

Parents remain anonymous by default. Existing chats and shared-circle entry
points continue to work immediately, with one canonical conversation per pair.

The New Message flow uses two privacy-preserving paths:

1. Shared-circle suggestions list anonymous parents who share at least one
   circle with the viewer. Selecting one creates or resumes a conversation.
2. Exact-handle contact allows a parent to enter another parent's complete
   anonymous handle or open an invite link containing that handle. If the pair
   do not share a circle, Vaara sends a connection request instead of opening a
   writable conversation.

There is no fuzzy parent search or global directory. Real names, phone numbers,
email addresses, child details, and school membership are not searchable.
Exact-handle requests are rate-limited and blocked users cannot create, accept,
or use them.

Connection requests may be accepted, declined, or cancelled. Acceptance creates
or resumes the canonical conversation transactionally. Normal messages cannot
be sent before acceptance. Existing mutual, per-conversation disclosure rules
remain unchanged and never alter identity shown in circle feeds.

Unread counts include only messages sent by the peer after the viewer's
`last_read_at`. Opening a conversation marks it read. Inbox and request changes
are delivered over a self-authorized realtime user channel and remain
refreshable manually if realtime is unavailable.

## Rollout order

1. Apply the parent connection-request migration.
2. Deploy API, Redis package, realtime gateway, and worker changes.
3. Deploy the mobile client.
4. Verify nearby school ordering, rating masking, exact-handle requests,
   acceptance, unread counts, blocks, and realtime refresh.
