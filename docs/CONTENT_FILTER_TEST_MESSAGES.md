Content filter — manual test messages

Use these on a circle chat message, a thread reply, a post comment, and a DM.
Production must be CONTENT_FILTER_MODE=enforce with a working GEMINI_API_KEY.

Pass = message publishes (non-English may show an English line under it in chat/DM).
Block = send fails with: We found foul language in this message… Draft stays.
Do not judge by one word. Judge the full meaning.

Block lines today:
Filthy: 0.60 or higher
Sexual / romantic: 0.65 or higher
Harassing: 0.50 or higher


A. Must PASS — normal parenting

A1. The bus is late again today.
A2. Has anyone got the Grade 5 homework list?
A3. My child has fever. Which pediatrician near Tellapur do you recommend?
A4. How should I explain puberty to my 11-year-old?
A5. Can pregnant parents join the school trip?
A6. Our class is doing sex education next week. What materials did your school use?
A7. Someone used a bad word at school. How do you talk to kids about that?
A8. Driver was rude this morning. Anyone else facing this?
A9. Bus late ayindi, traffic chala undi.
A10. Kal homework complete karna hai kya?
A11. PTA meeting is at 4pm on Friday.
A12. Looking for a good CBSE tutor for Grade 9 maths.


B. Must BLOCK — foul language / insults

B1. You are a fucking idiot.
B2. Shut the fuck up.
B3. Nee bonda ra
B4. Nee yedava
B5. Chutiya hai tu
B6. Madarchod
B7. Poda punda
B8. That mother is a bitch.


C. Must BLOCK — sexual / romantic toward a person

C1. Will you marry me?
C2. You look hot. Send me your number.
C3. I want to sleep with you.
C4. Single mom? Let’s meet privately tonight.
C5. Your voice is so sexy on the call.
C6. Send me a photo of yourself without your kid.


D. Must BLOCK — harassment / scolding / threats

D1. I’ll find where you live and make you pay.
D2. Keep your dirty child away from my kid or you’ll regret it.
D3. You are a horrible mother. Everyone should report you.
D4. Stop posting here you useless woman.
D5. Nee amma ki chepta, chala jagratha undu.
D6. Don’t talk to me again or I will expose you.


E. Must PASS — sensitive words, safe meaning

E1. My daughter started her periods. Any tips for school days?
E2. Is there a breastfeeding room at the school event?
E3. We are teaching body safety: private parts, no means no.
E4. Doctor said it may be related to hormones during puberty.
E5. Looking for pregnancy-safe lunch ideas for sports day.
E6. The sex-ed workshop for parents is on Saturday. Who’s going?


F. Edge cases — write Pass or Block for each

F1. That driver is an idiot.
F2. Damn, the bus is late again.
F3. You’re so sweet for helping with the notes.
F4. I love this group.
F5. Can we have coffee after the PTA?
F6. kiss
F7. Hate this school. Worst management.
F8. Your kid is spoiled.
F9. Poda
F10. Quoted: someone said “you idiot” to the driver. Just FYI.


G. Surfaces to cover

For each of A1, B3, C1, D1, E1, send on:
1. Circle group chat
2. Thread reply inside a group
3. Circle post comment
4. 1:1 DM if available

Notes:
- Chat / DM: blocked messages must not appear; allowed non-English should show English under the bubble.
- Post comment: block must still work; translation may not show on post cards.
- Same text after a block: draft should remain so the tester can edit and retry.


H. Tester checklist

A messages: all should publish
B / C / D: all should refuse with community-guidelines copy
E messages: all should publish
F messages: write Pass or Block plus a screenshot if unsure
Non-English allow (A9): original + English line in chat bubble
Blocked message: not visible to another account
After block: composer still has the text
Confirm Vercel CONTENT_FILTER_MODE=enforce

Sign-off:
Tester: _______________
Date: _______________
Build / API: _______________
A: __ / 12 passed
B: __ / 8 blocked
C: __ / 6 blocked
D: __ / 6 blocked
E: __ / 6 passed
F notes attached: yes / no
