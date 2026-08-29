import assert from "node:assert/strict";
import test from "node:test";
import {
  apiOk,
  apiRequest,
  apiUrl,
  assertDb,
  auditEnabled,
  fetchOnboardingFixture,
  onboardParent,
  printAuditReport,
  registerUser,
  runCheck,
  setParentLocation,
  type AuditResult,
  type TestUser,
} from "./helpers/e2e.js";

test(
  "end-to-end API + database audit",
  { skip: !auditEnabled(), timeout: 120_000 },
  async () => {
    const results: AuditResult[] = [];

    results.push(
      await runCheck("health", async () => {
        const { status, body } = await apiRequest<{ status: string }>("/health");
        assert.equal(status, 200);
        assert.equal(body.status, "ok");
      })
    );

    results.push(
      await assertDb(
        "schema migration 025 (parent_connection_requests)",
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_name = 'parent_connection_requests'
         ) AS exists`,
        [],
        (rows) => rows[0]?.exists === true,
        "parent_connection_requests table present"
      )
    );

    let parentA: TestUser;
    let parentB: TestUser;
    let provider: TestUser;

    results.push(
      await runCheck("auth register parent A + B + provider", async () => {
        parentA = await registerUser("parent", "a");
        parentB = await registerUser("parent", "b");
        provider = await registerUser("provider", "p");
        assert.notEqual(parentA.userId, parentB.userId);
      })
    );

    results.push(
      await assertDb(
        "auth users persisted",
        "SELECT COUNT(*)::int AS count FROM users WHERE id = ANY($1::uuid[])",
        [[parentA!.userId, parentB!.userId, provider!.userId]],
        (rows) => rows[0]?.count === 3,
        "3 audit users in users table"
      )
    );

    results.push(
      await runCheck("GET /v1/me", async () => {
        const me = await apiOk<{ id: string; anonymousHandle: string }>(
          "/v1/me",
          parentA!.token
        );
        assert.equal(me.id, parentA!.userId);
        assert.equal(me.anonymousHandle, parentA!.handle);
      })
    );

    let circleId: string | undefined;
    const fixture = await fetchOnboardingFixture();

    results.push(
      await runCheck("POST /v1/me/children (onboarding)", async () => {
        await onboardParent(parentA!.token, fixture, "AuditKid");
        await onboardParent(parentB!.token, fixture, "AuditKidB");
        await setParentLocation(parentA!.token);
        await setParentLocation(parentB!.token);
      })
    );

    results.push(
      await assertDb(
        "child row + circle membership",
        `SELECT
           (SELECT COUNT(*)::int FROM children WHERE user_id = $1) AS child_count,
           (SELECT COUNT(*)::int FROM circle_members WHERE user_id = $1) AS circle_count`,
        [parentA!.userId],
        (rows) =>
          (rows[0]?.child_count as number) === 1 &&
          (rows[0]?.circle_count as number) > 0,
        "child created and circles assigned"
      )
    );

    results.push(
      await runCheck("GET /v1/me/stats", async () => {
        const stats = await apiOk<{
          circleCount: number;
          savedPostCount: number;
          helpfulReceivedCount: number;
        }>("/v1/me/stats", parentA!.token);
        assert.ok(stats.circleCount >= 1);
        assert.equal(typeof stats.savedPostCount, "number");
        assert.equal(typeof stats.helpfulReceivedCount, "number");
      })
    );

    results.push(
      await runCheck("PATCH /v1/me/notification-prefs (quiet hours)", async () => {
        const updated = await apiOk<{ quiet_hours: { start: string; end: string } }>(
          "/v1/me/notification-prefs",
          parentA!.token,
          {
            method: "PATCH",
            body: JSON.stringify({
              quiet_hours: { enabled: true, start: "22:00", end: "07:00" },
            }),
          }
        );
        assert.equal(updated.quiet_hours.start, "22:00");
      })
    );

    results.push(
      await runCheck("PUT /v1/me/contact-details", async () => {
        await apiOk("/v1/me/contact-details", parentA!.token, {
          method: "PUT",
          body: JSON.stringify({
            firstName: "Audit",
            blockOrFlat: "A-101",
            contactPhone: "9999999999",
          }),
        });
      })
    );

    results.push(
      await assertDb(
        "contact details stored",
        `SELECT first_name, block_or_flat FROM user_contact_details WHERE user_id = $1`,
        [parentA!.userId],
        (rows) => rows[0]?.first_name === "Audit",
        "contact details row present"
      )
    );

    results.push(
      await runCheck("GET /v1/circles", async () => {
        const circles = await apiOk<unknown[]>("/v1/circles", parentA!.token);
        assert.ok(circles.length > 0);
      })
    );

    let circleId: string | undefined;
    let postId: string | undefined;

    results.push(
      await runCheck("POST circle post + helpful + save", async () => {
        const circles = await apiOk<Array<{ id: string }>>(
          "/v1/circles",
          parentA!.token
        );
        circleId = circles[0]!.id;
        const post = await apiOk<{ id: string }>(
          `/v1/circles/${circleId}/posts`,
          parentA!.token,
          {
            method: "POST",
            body: JSON.stringify({ body: `Audit post ${Date.now()}` }),
          }
        );
        postId = post.id;
        await apiOk(`/v1/me/posts/${postId}/helpful`, parentB!.token, {
          method: "POST",
        });
        await apiOk("/v1/me/saved", parentB!.token, {
          method: "POST",
          body: JSON.stringify({ itemType: "post", itemId: postId }),
        });
      })
    );

    results.push(
      await assertDb(
        "helpful mark + saved item",
        `SELECT
           (SELECT COUNT(*)::int FROM post_helpful_marks WHERE post_id = $1 AND user_id = $2) AS helpful,
           (SELECT COUNT(*)::int FROM saved_items WHERE user_id = $2 AND item_type = 'post' AND item_id = $1) AS saved`,
        [postId, parentB!.userId],
        (rows) =>
          (rows[0]?.helpful as number) === 1 && (rows[0]?.saved as number) === 1,
        "helpful and saved rows present"
      )
    );

    let conversationId: string | undefined;
    let requestId: string | undefined;

    results.push(
      await runCheck("connection request → accept → message", async () => {
        const started = await apiOk<{
          kind: string;
          request?: { id: string };
          conversation?: { id: string };
        }>("/v1/conversations/requests", parentA!.token, {
          method: "POST",
          body: JSON.stringify({
            anonymousHandle: parentB!.handle,
            introduction: "E2E audit",
          }),
        });

        if (started.kind === "request") {
          requestId = started.request!.id;
          const accepted = await apiOk<{ conversationId: string }>(
            `/v1/conversations/requests/${requestId}`,
            parentB!.token,
            { method: "PATCH", body: JSON.stringify({ action: "accept" }) }
          );
          conversationId = accepted.conversationId;
        } else {
          conversationId = started.conversation!.id;
        }

        await apiOk(`/v1/conversations/${conversationId}/messages`, parentA!.token, {
          method: "POST",
          body: JSON.stringify({ body: `Audit msg ${Date.now()}` }),
        });
      })
    );

    results.push(
      await assertDb(
        "connection request accepted + message row",
        `SELECT
           (SELECT status FROM parent_connection_requests WHERE id = $1) AS request_status,
           (SELECT COUNT(*)::int FROM direct_messages WHERE conversation_id = $2) AS message_count`,
        [requestId ?? null, conversationId],
        (rows) => {
          const requestOk =
            !requestId || rows[0]?.request_status === "accepted";
          return requestOk && (rows[0]?.message_count as number) >= 1;
        },
        "request accepted and message stored"
      )
    );

    let listingId: string | undefined;

    results.push(
      await runCheck("marketplace listing create + interest", async () => {
        const listing = await apiOk<{ id: string }>("/v1/listings", parentA!.token, {
          method: "POST",
          body: JSON.stringify({
            kind: "free",
            category: "other",
            title: `Audit listing ${Date.now()}`,
            description: "E2E audit item",
          }),
        });
        listingId = listing.id;
        const mine = await apiOk<unknown[]>("/v1/listings/mine", parentA!.token);
        assert.ok(mine.some((item: { id?: string }) => item.id === listingId));
        await apiOk(`/v1/listings/${listingId}/interest`, parentB!.token, {
          method: "POST",
        });
      })
    );

    results.push(
      await assertDb(
        "listing row",
        "SELECT COUNT(*)::int AS count FROM listings WHERE id = $1 AND seller_id = $2",
        [listingId, parentA!.userId],
        (rows) => rows[0]?.count === 1,
        "listing persisted"
      )
    );

    results.push(
      await runCheck("topics catalog + follow", async () => {
        const catalog = await apiOk<{ categories: Record<string, unknown[]> }>(
          "/v1/topics",
          parentA!.token
        );
        const firstTopic = Object.values(catalog.categories)[0]?.[0] as
          | { slug: string }
          | undefined;
        assert.ok(firstTopic?.slug);
        await apiOk(`/v1/topics/${firstTopic!.slug}/follow`, parentA!.token, {
          method: "POST",
        });
      })
    );

    results.push(
      await runCheck("schools nearby + reminders", async () => {
        const nearby = await apiOk<unknown[]>("/v1/schools/nearby", parentA!.token);
        assert.ok(Array.isArray(nearby));
        const reminder = await apiOk<{ id: string }>("/v1/me/reminders", parentA!.token, {
          method: "POST",
          body: JSON.stringify({
            title: "Audit reminder",
            fireAt: new Date(Date.now() + 86_400_000).toISOString(),
          }),
        });
        assert.ok(reminder.id);
      })
    );

    results.push(
      await runCheck("playdates + carpool + practitioners (read)", async () => {
        await apiOk("/v1/playdates/matches", parentA!.token);
        await apiOk("/v1/carpool/matches", parentA!.token);
        await apiOk("/v1/practitioners", parentA!.token);
        await apiOk("/v1/expert-sessions", parentA!.token);
      })
    );

    results.push(
      await runCheck("provider profile + activities", async () => {
        await apiOk("/v1/provider/profile", provider!.token, {
          method: "PATCH",
          body: JSON.stringify({
            providerType: "teacher",
            orgName: `Audit Org ${Date.now()}`,
            servicePinCodes: ["560102"],
          }),
        });
        const activities = await apiOk<unknown[]>(
          "/v1/provider/activities",
          provider!.token
        );
        assert.ok(Array.isArray(activities));
        await apiOk("/v1/activities", parentA!.token);
      })
    );

    results.push(
      await runCheck("POST /v1/me/reports", async () => {
        await apiOk("/v1/me/reports", parentA!.token, {
          method: "POST",
          body: JSON.stringify({
            targetUserId: parentB!.userId,
            reason: "E2E audit report",
          }),
        });
      })
    );

    results.push(
      await assertDb(
        "report row",
        "SELECT COUNT(*)::int AS count FROM reports WHERE reporter_id = $1 AND target_user_id = $2",
        [parentA!.userId, parentB!.userId],
        (rows) => (rows[0]?.count as number) >= 1,
        "report stored"
      )
    );

    results.push(
      await runCheck("GET /v1/me/notifications", async () => {
        const notifications = await apiOk<unknown[]>(
          "/v1/me/notifications",
          parentB!.token
        );
        assert.ok(Array.isArray(notifications));
      })
    );

    console.log(`Audit target: ${apiUrl()}`);
    printAuditReport(results);
  }
);
