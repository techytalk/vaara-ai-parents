import type { PoolClient } from "pg";

export type PollView = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; voteCount: number }>;
  myOptionId: string | null;
  totalVotes: number;
  resultsVisible: boolean;
  closesAt: string | null;
};

type PollInput = {
  question: string;
  options: string[];
  hideResultsUntilVote?: boolean;
  closesAt?: string;
};

export function validatePollInput(poll: PollInput): string | null {
  const question = poll.question.trim();
  if (question.length < 1 || question.length > 200) {
    return "Poll question must be 1–200 characters";
  }

  const options = poll.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 6) {
    return "Polls need 2–6 options";
  }
  if (options.some((o) => o.length > 80)) {
    return "Each poll option must be 80 characters or less";
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return "Poll options must be unique";
  }
  return null;
}

export async function createPollForPost(
  client: PoolClient,
  postId: string,
  poll: PollInput
): Promise<void> {
  const question = poll.question.trim();
  const options = poll.options.map((o) => o.trim()).filter(Boolean);

  const { rows } = await client.query(
    `INSERT INTO post_polls (post_id, question, results_hidden_until_vote, closes_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      postId,
      question,
      poll.hideResultsUntilVote ?? false,
      poll.closesAt ?? null,
    ]
  );

  const pollId = rows[0].id as string;
  for (const [index, label] of options.entries()) {
    await client.query(
      `INSERT INTO poll_options (poll_id, label, sort_order) VALUES ($1, $2, $3)`,
      [pollId, label, index]
    );
  }
}

export async function loadPostPolls(
  client: PoolClient,
  postIds: string[],
  viewerId: string,
  circleMemberCount: number
): Promise<Map<string, PollView>> {
  const result = new Map<string, PollView>();
  if (postIds.length === 0) return result;

  const { rows: polls } = await client.query(
    `SELECT id, post_id, question, results_hidden_until_vote, closes_at
     FROM post_polls
     WHERE post_id = ANY($1::uuid[])`,
    [postIds]
  );
  if (polls.length === 0) return result;

  const pollIds = polls.map((p) => p.id);
  const { rows: options } = await client.query(
    `SELECT po.id, po.poll_id, po.label, po.sort_order,
            COUNT(pv.user_id)::int AS vote_count
     FROM poll_options po
     LEFT JOIN poll_votes pv ON pv.option_id = po.id
     WHERE po.poll_id = ANY($1::uuid[])
     GROUP BY po.id
     ORDER BY po.sort_order`,
    [pollIds]
  );

  const { rows: myVotes } = await client.query(
    `SELECT poll_id, option_id FROM poll_votes
     WHERE poll_id = ANY($1::uuid[]) AND user_id = $2`,
    [pollIds, viewerId]
  );
  const myVoteByPoll = new Map(
    myVotes.map((v) => [v.poll_id as string, v.option_id as string])
  );

  const optionsByPoll = new Map<string, typeof options>();
  for (const option of options) {
    const list = optionsByPoll.get(option.poll_id) ?? [];
    list.push(option);
    optionsByPoll.set(option.poll_id, list);
  }

  for (const poll of polls) {
    const pollOptions = optionsByPoll.get(poll.id) ?? [];
    const totalVotes = pollOptions.reduce(
      (sum, o) => sum + Number(o.vote_count),
      0
    );
    const myOptionId = myVoteByPoll.get(poll.id) ?? null;
    const hideUntilVote = poll.results_hidden_until_vote as boolean;
    const smallCircle = circleMemberCount < 5;
    const belowThreshold = totalVotes < 5;
    const resultsVisible =
      !smallCircle &&
      !belowThreshold &&
      (!hideUntilVote || myOptionId !== null);

    result.set(poll.post_id, {
      id: poll.id,
      question: poll.question,
      options: pollOptions.map((o) => ({
        id: o.id,
        label: o.label,
        voteCount: resultsVisible ? Number(o.vote_count) : 0,
      })),
      myOptionId,
      totalVotes: resultsVisible ? totalVotes : 0,
      resultsVisible,
      closesAt: poll.closes_at,
    });
  }

  return result;
}

export async function castPollVote(
  client: PoolClient,
  params: {
    pollId: string;
    optionId: string;
    userId: string;
  }
): Promise<string | null> {
  const pollResult = await client.query(
    `SELECT id, closes_at FROM post_polls WHERE id = $1`,
    [params.pollId]
  );
  if (pollResult.rows.length === 0) return "Poll not found";

  const poll = pollResult.rows[0];
  if (poll.closes_at && new Date(poll.closes_at) <= new Date()) {
    return "This poll has closed";
  }

  const optionResult = await client.query(
    `SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2`,
    [params.optionId, params.pollId]
  );
  if (optionResult.rows.length === 0) return "Invalid poll option";

  await client.query(
    `INSERT INTO poll_votes (poll_id, user_id, option_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id)
     DO UPDATE SET option_id = EXCLUDED.option_id, updated_at = now()`,
    [params.pollId, params.userId, params.optionId]
  );
  return null;
}

export async function getPollForPost(
  client: PoolClient,
  postId: string
): Promise<{ id: string } | null> {
  const { rows } = await client.query(
    `SELECT id FROM post_polls WHERE post_id = $1`,
    [postId]
  );
  return rows.length > 0 ? { id: rows[0].id } : null;
}
