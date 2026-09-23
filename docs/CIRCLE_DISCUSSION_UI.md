# Circle discussion UI

**Status:** The circle channel uses this bubble layout in
`ChatThreadScreen`. The opened-thread header in § below is still spec.
Colors, type, and spacing stay on the mobile theme in
`apps/mobile/src/constants/theme.ts`. Do not introduce a separate dark
palette from the reference shots.

This is the circle interior for the Slack-style model in
[`SLACK_STYLE_THREADS.md`](./SLACK_STYLE_THREADS.md). Attachments follow
[`CHAT_MESSAGE_ATTACHMENTS.md`](./CHAT_MESSAGE_ATTACHMENTS.md).

---

## Decisions

### 1. Reply inside a thread

**Today it does not work.** On the circle channel, each message has a
thread control and a reply arrow. Inside the opened thread those
controls are hidden (`showThreadActions` is only on for the channel).
A send from the thread composer is a new reply in that thread. It does
not quote the message you tapped, and it cannot start a second thread.

**Target.** The reply arrow on a message inside the thread quotes that
message into the composer. Sending posts the reply in the **same**
thread, with the quoted message shown above it. It does not open
another thread and does not add a new row to the circle list.

One level only. A channel message can grow a thread. A reply inside
that thread cannot grow its own thread.

### 2. Your messages stay on the right

Other parents stay on the left. Your replies stay on the right, same
alignment as current chat bubbles (`mine` → right).

The opened-thread reference shows every reply on the left. Ignore that
alignment. The root discussion stays a full-width card at the top,
including when you wrote it. Only the replies under it split left and
right.

### 3. Every circle message can be a thread

Yes. Each message in the circle channel is a possible thread root.
Tapping the reply count, or “Be first to reply”, opens that message’s
thread. The first reply creates it. Later replies open the same thread.

Replies inside the thread are not new circle messages and do not become
their own threads.

---

## Circle channel (the screen you land on)

This is a chat, on the app theme. Background is `colors.bg`. Other
people’s bubbles are `colors.card` with `colors.border`. Yours are
`colors.primary` with `colors.textInverse`. Do not use the dark green
canvas from the reference.

A centered day label (`Today`, `Yesterday`, or a short date) sits above
the first message of that day. `colors.textSubtle`.

```
Today

[avatar] Parent–YSNY
┌─────────────────────────────┐
│ Message text                │
│ ┌ Reading-routine.pdf    > ┐│
│ │ PDF · size               ││
│ └──────────────────────────┘│
│                      9:14 am│
└─────────────────────────────┘
💬 3 replies          👍 4  🙂  ⋯

                         You
        ┌─────────────────────────────┐
        │ Message text                │
        │ [ photo ] [ photo ]         │
        │              9:30 am  ✓     │
        └─────────────────────────────┘
        💬 1 reply            👍 2  🙂  ⋯
```

| Piece | Rule |
|---|---|
| Name | Above the bubble. Others: avatar + anonymous handle. You: **You**, right-aligned, no avatar. Guest and Tutor labels stay when they already apply. |
| Grade | Shown only when the message already carries a grade. Do not invent one. |
| Body | Theirs: `colors.text`. Yours: `colors.textInverse`. English translation stays under non-English text. |
| Time | Inside the bubble, bottom right. Yours also shows a single check when the message is visible. |
| Reply row | Under the bubble, full width of the bubble. Speech bubble + “3 replies”, “1 reply”, or “Be first to reply” in `colors.primary`. Tap opens the thread. |
| Like | Thumb + count when the count is above 0. |
| React | Smile icon opens the existing reaction sheet. Other reactions stay as chips under the row. |
| More | ⋯ keeps report, delete, and the other message actions already on the channel. |

---

## Opened thread

The root message is the first bubble, same layout as the channel:
yours on the right, everyone else on the left, attachments inside the
bubble. Under it, a muted line says **1 reply** or **3 replies**. Hide
that line when there are no replies yet.

Each message in the thread, including the root, has like, react, the
reply arrow, and more. The arrow quotes that message into the composer
and sends the reply in this same thread. It does not start another
thread.

The composer sits above the home indicator while the keyboard is
closed, and directly above the keyboard while it is open. A text reply
still shows “Checking community guidelines…”.

---

## Attachments

Show them inside the bubble. Do not hide media behind a separate post
layout.

| Kind | Where | How |
|---|---|---|
| Photos | Inside the bubble, under the text | Rounded tiles, side by side when there are two. Tap opens the gallery. |
| Video | Same slot as photos | Play icon, duration pill at the bottom right of the tile. |
| Documents | Inside the bubble, under the text | Light file card: icon, file name, type and size, chevron. On your teal bubble the card stays `colors.card` so the name stays readable. Tap opens the file. |
| Attachment only | Bubble with no text | The file or media is the body. Reply count and reactions still show under it. |
| Several files | One message | Up to the current chat limits (4 photos or videos, documents alongside) |

A message with several photos stays one bubble. The reply count belongs
to the message, not to each file.

Inside the thread, attachments on the root stay in the root card.
Attachments on a reply stay inside that reply, left or right with the
author.

---

## What this does not change

- Channel vs thread is still one level. Quote-reply is a pointer, not a
  new thread.
- Discovery threads stay view-only. No reply arrow, no composer.
- Direct messages stay in Messages. This layout is the circle only.
- Handles stay anonymous. Grade, when present, is context, not a name.
