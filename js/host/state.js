// Adventure state helpers shared by scene handlers: flags, per-player stats, card lines.

export function setFlags(ctx, patch) {
  if (!patch) return;
  ctx.setState({ flags: { ...(ctx.state.flags ?? {}), ...patch } });
}

export function flag(ctx, key) {
  return ctx.state.flags?.[key];
}

/** Increment a per-player counter (help, sabotage, steal, pact, votesAgainst, pools…). */
export function bump(ctx, pid, key, amount = 1) {
  const stats = ctx.state.stats ?? {};
  const mine = stats[pid] ?? {};
  ctx.setState({ stats: { ...stats, [pid]: { ...mine, [key]: (mine[key] ?? 0) + amount } } });
}

/** Append lines to a player's secret card (keeps what they already know). */
export function addCardLines(ctx, pid, lines) {
  const card = ctx.getCard(pid) ?? { tone: 'secret', title: '🔒 La tua carta', lines: [] };
  ctx.sendCard(pid, { ...card, lines: [...(card.lines ?? []), ...lines] });
}
