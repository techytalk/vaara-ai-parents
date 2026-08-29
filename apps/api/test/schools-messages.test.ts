import assert from "node:assert/strict";
import test from "node:test";
import { mapSchoolListRow } from "../src/lib/school.js";

test("school list ratings remain hidden below three reviews", () => {
  const school = mapSchoolListRow({
    id: "school-1",
    name: "Example School",
    branch: null,
    city: "Bengaluru",
    state: "Karnataka",
    pin_code: "560102",
    verified: false,
    rating_avg: "5.00",
    rating_count: 2,
  });

  assert.equal(school.ratingAvg, null);
  assert.equal(school.ratingCount, 2);
});

test("school list ratings are returned at three reviews", () => {
  const school = mapSchoolListRow({
    id: "school-1",
    name: "Example School",
    branch: null,
    city: "Bengaluru",
    state: "Karnataka",
    pin_code: "560102",
    verified: true,
    rating_avg: "4.25",
    rating_count: 3,
  });

  assert.equal(school.ratingAvg, 4.25);
  assert.equal(school.ratingCount, 3);
});

const integrationEnabled =
  process.env.RUN_MUTATING_INTEGRATION_TESTS === "1" &&
  Boolean(process.env.TEST_API_URL) &&
  Boolean(process.env.TEST_PARENT_A_TOKEN) &&
  Boolean(process.env.TEST_PARENT_B_TOKEN) &&
  Boolean(process.env.TEST_PARENT_B_HANDLE);

test(
  "nearby schools and connection request unread flow",
  { skip: !integrationEnabled },
  async () => {
    const apiUrl = process.env.TEST_API_URL!;
    const tokenA = process.env.TEST_PARENT_A_TOKEN!;
    const tokenB = process.env.TEST_PARENT_B_TOKEN!;
    const handleB = process.env.TEST_PARENT_B_HANDLE!;

    async function request(
      path: string,
      token: string,
      init?: RequestInit
    ) {
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      });
      const body = await response.json();
      assert.ok(
        response.ok,
        `${init?.method ?? "GET"} ${path} failed: ${JSON.stringify(body)}`
      );
      return body;
    }

    const nearby = await request("/v1/schools/nearby", tokenA);
    assert.ok(Array.isArray(nearby));
    for (const school of nearby) {
      assert.equal(typeof school.ratingCount, "number");
      assert.ok(school.ratingAvg === null || typeof school.ratingAvg === "number");
    }

    const started = await request("/v1/conversations/requests", tokenA, {
      method: "POST",
      body: JSON.stringify({
        anonymousHandle: handleB,
        introduction: "Integration test request",
      }),
    });

    let conversationId: string;
    if (started.kind === "request") {
      const requests = await request("/v1/conversations/requests", tokenB);
      assert.ok(
        requests.incoming.some(
          (item: { id: string }) => item.id === started.request.id
        )
      );
      const accepted = await request(
        `/v1/conversations/requests/${started.request.id}`,
        tokenB,
        { method: "PATCH", body: JSON.stringify({ action: "accept" }) }
      );
      conversationId = accepted.conversationId;
    } else {
      conversationId = started.conversation.id;
    }
    assert.ok(conversationId);

    await request(`/v1/conversations/${conversationId}/messages`, tokenA, {
      method: "POST",
      body: JSON.stringify({ body: `Integration ${Date.now()} A` }),
    });
    await request(`/v1/conversations/${conversationId}/messages`, tokenA, {
      method: "POST",
      body: JSON.stringify({ body: `Integration ${Date.now()} B` }),
    });

    const beforeRead = await request("/v1/conversations", tokenB);
    const preview = beforeRead.find(
      (item: { id: string }) => item.id === conversationId
    );
    assert.ok(preview);
    assert.ok(preview.unreadCount >= 2);

    await request(`/v1/conversations/${conversationId}/read`, tokenB, {
      method: "PATCH",
    });
    const afterRead = await request("/v1/conversations", tokenB);
    assert.equal(
      afterRead.find((item: { id: string }) => item.id === conversationId)
        .unreadCount,
      0
    );
  }
);
