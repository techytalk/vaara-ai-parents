import assert from "node:assert/strict";
import test from "node:test";
import {
  apiOk,
  apiRequest,
  auditEnabled,
  fetchOnboardingFixture,
  onboardParent,
  registerUser,
  setParentLocation,
} from "./helpers/e2e.js";

test(
  "Anusha group-chat journeys",
  { skip: !auditEnabled(), timeout: 120_000 },
  async () => {
    const fixture = await fetchOnboardingFixture();
    const anusha = await registerUser("parent", "anusha");
    const priya = await registerUser("parent", "priya");
    await setParentLocation(anusha.token, "502032");
    await setParentLocation(priya.token, "502032");
    await onboardParent(anusha.token, fixture, "A");
    await onboardParent(priya.token, fixture, "P");

    const circles = await apiOk<Array<{ id: string; circleType: string }>>(
      "/v1/circles",
      anusha.token
    );
    const schoolClass = circles.find((item) => item.circleType === "school_class");
    const locality = circles.find((item) => item.circleType === "locality");
    assert.ok(schoolClass, "Anusha should have a school_class group");
    assert.ok(locality, "Anusha should have a locality group");

    const linear = await apiOk<{ messages: unknown[] }>(
      `/v1/circles/${schoolClass.id}/messages`,
      anusha.token,
      {
        method: "POST",
        body: JSON.stringify({
          body: "White shoes tomorrow?",
          clientMessageId: crypto.randomUUID(),
        }),
      }
    );
    assert.ok("id" in linear);

    const homeBefore = await apiOk<{ items: Array<{ id: string; kind: string }> }>(
      "/v1/chat/home?limit=20",
      anusha.token
    );
    assert.equal(
      homeBefore.items.some((item) => item.id === (linear as { id: string }).id),
      false,
      "linear class chat must not appear as a Home row"
    );

    const thread = await apiOk<{ id: string; created_seq?: number }>(
      `/v1/circles/${locality.id}/threads`,
      anusha.token,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Which pediatrician near 502032?",
          body: "Need a recommendation",
          kind: "question",
        }),
      }
    );
    assert.ok(thread.id);

    const home = await apiOk<{
      items: Array<{ id: string; kind: string }>;
      nextCursor: string | null;
    }>(`/v1/chat/home?limit=20`, anusha.token);
    assert.ok(home.items.some((item) => item.id === thread.id));

    const opened = await apiOk<{
      id: string;
      access: { canReply: boolean };
      muted?: boolean;
    }>(`/v1/threads/${thread.id}`, priya.token);
    assert.equal(opened.id, thread.id);
    assert.equal(opened.access.canReply, true);

    const reply = await apiOk<{ id: string; seq: number; circleId: string }>(
      `/v1/threads/${thread.id}/messages`,
      priya.token,
      {
        method: "POST",
        body: JSON.stringify({
          body: "We like Rainbow Children's",
          clientMessageId: crypto.randomUUID(),
        }),
      }
    );

    const catchUp = await apiOk<{ messages: Array<{ id: string }> }>(
      `/v1/threads/${thread.id}/messages?afterSeq=${reply.seq - 1}`,
      anusha.token
    );
    assert.ok(catchUp.messages.some((item) => item.id === reply.id));

    await apiOk(`/v1/circles/${reply.circleId}/messages/${reply.id}`, priya.token, {
      method: "PATCH",
      body: JSON.stringify({ body: "We like Rainbow Children's Hospital" }),
    });
    await apiOk(
      `/v1/circles/${reply.circleId}/messages/${reply.id}/reactions`,
      anusha.token,
      { method: "POST", body: JSON.stringify({ reaction: "👍" }) }
    );

    const muted = await apiOk<{ muted: boolean }>(
      `/v1/threads/${thread.id}/mute`,
      anusha.token,
      { method: "POST" }
    );
    assert.equal(muted.muted, true);

    const page1 = await apiOk<{ nextCursor: string | null; items: unknown[] }>(
      "/v1/chat/home?limit=1",
      anusha.token
    );
    if (page1.nextCursor) {
      const page2 = await apiRequest(
        `/v1/chat/home?limit=1&cursor=${encodeURIComponent(page1.nextCursor)}`,
        anusha.token
      );
      assert.equal(page2.status, 200);
    }

    const deleted = await apiOk<{ ok: boolean }>(
      `/v1/circles/${reply.circleId}/messages/${reply.id}`,
      priya.token,
      { method: "DELETE" }
    );
    assert.equal(deleted.ok, true);
  }
);
