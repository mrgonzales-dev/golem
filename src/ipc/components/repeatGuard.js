/**
 * Repeat-call guard for one agent turn.
 *
 * Tracks the consecutive streak, the lifetime count, and the last
 * result per call signature (tool name + raw arguments) so the loop
 * can stop true loops and warn on true repeats without lying about
 * results that changed. AgentSession.note() resets it when the disk
 * changes out of band (a diff approval), so a re-read after approve
 * is not counted as a loop.
 */
class RepeatGuard {
  constructor() {
    this.reset();
  }

  reset() {
    this.lastSignature = null;
    this.dupStreak = 0;
    this.lifetimeCounts = new Map();
    this.lastResults = new Map();
  }

  // Record a call about to run. Returns the streak length so far.
  record(signature) {
    this.dupStreak = signature === this.lastSignature ? this.dupStreak + 1 : 0;
    this.lastSignature = signature;
    const count = (this.lifetimeCounts.get(signature) || 0) + 1;
    this.lifetimeCounts.set(signature, count);
    return { dupStreak: this.dupStreak, lifetimeCount: count };
  }

  // True when this exact call ran before and produced the same output.
  sameAsLast(signature, result) {
    const prev = this.lastResults.get(signature);
    this.lastResults.set(signature, result);
    return prev !== undefined && prev === result;
  }
}

module.exports = { RepeatGuard };
