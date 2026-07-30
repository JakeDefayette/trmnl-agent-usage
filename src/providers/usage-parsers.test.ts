import { describe, expect, test } from "bun:test";
import { parseClaudeUsage } from "./claude.js";
import { parseCodexUsage } from "./codex.js";

describe("parseClaudeUsage", () => {
  test("maps the scoped Fable weekly limit from the limits array", () => {
    const data = parseClaudeUsage({
      five_hour: {
        utilization: 10,
        resets_at: "2026-07-30T02:30:00Z",
      },
      seven_day: {
        utilization: 20,
        resets_at: "2026-08-02T14:00:00Z",
      },
      limits: [
        {
          kind: "weekly_scoped",
          group: "weekly",
          percent: 18,
          resets_at: "2026-08-02T14:00:00Z",
          scope: {
            model: {
              display_name: "Fable",
            },
          },
        },
      ],
      extra_usage: {
        is_enabled: false,
      },
    });

    expect(data.primaryLabel).toBe("Session");
    expect(data.primaryPercent).toBe(10);
    expect(data.secondaryLabel).toBe("Weekly");
    expect(data.secondaryPercent).toBe(20);
    expect(data.tertiaryLabel).toBe("Fable");
    expect(data.tertiaryPercent).toBe(18);
    expect(data.extraUsageEnabled).toBe(false);
  });

  test("keeps an omitted extra-usage state unknown", () => {
    const data = parseClaudeUsage({});

    expect(data.extraUsageEnabled).toBeUndefined();
  });
});

describe("parseCodexUsage", () => {
  test("uses weekly labels, includes Spark, and exposes the reset bank", () => {
    const data = parseCodexUsage(
      {
        plan_type: "prolite",
        rate_limit: {
          primary_window: {
            used_percent: 17,
            limit_window_seconds: 604_800,
            reset_at: 1_785_929_255,
          },
        },
        additional_rate_limits: [
          {
            limit_name: "GPT-5.3-Codex-Spark",
            rate_limit: {
              primary_window: {
                used_percent: 0,
                limit_window_seconds: 604_800,
                reset_at: 1_785_974_869,
              },
            },
          },
        ],
        rate_limit_reset_credits: {
          available_count: 1,
          applicable_available_count: 0,
        },
      },
      {
        available_count: 1,
        credits: [
          {
            status: "available",
            expires_at: "2026-08-12T17:53:11.086396Z",
          },
        ],
      },
    );

    expect(data.primaryLabel).toBe("Weekly");
    expect(data.primaryPercent).toBe(17);
    expect(data.secondaryLabel).toBe("Spark");
    expect(data.secondaryPercent).toBe(0);
    expect(data.resetCreditsAvailable).toBe(1);
    expect(data.resetCreditsApplicable).toBe(0);
    expect(data.resetCreditsExpiresAt?.toISOString()).toBe("2026-08-12T17:53:11.086Z");
    expect(data.planLabel).toBe("Pro Lite");
  });

  test("keeps reset counts from one snapshot and falls back from malformed expiry details", () => {
    const data = parseCodexUsage(
      {
        rate_limit_reset_credits: {
          available_count: 1,
          applicable_available_count: 0,
          expires_at: "2026-08-12T17:53:11.086Z",
        },
      },
      {
        available_count: 4,
        credits: [
          {
            status: "available",
            expires_at: "not-a-date",
          },
        ],
      },
    );

    expect(data.resetCreditsAvailable).toBe(1);
    expect(data.resetCreditsApplicable).toBe(0);
    expect(data.resetCreditsExpiresAt?.toISOString()).toBe("2026-08-12T17:53:11.086Z");
  });

  test("selects the chronologically earliest available reset credit", () => {
    const data = parseCodexUsage(
      {
        rate_limit_reset_credits: {
          available_count: 2,
          applicable_available_count: 0,
        },
      },
      {
        available_count: 2,
        credits: [
          {
            status: "available",
            expires_at: "2026-08-11T23:00:00-12:00",
          },
          {
            status: "available",
            expires_at: "2026-08-12T00:00:00+14:00",
          },
        ],
      },
    );

    expect(data.resetCreditsExpiresAt?.toISOString()).toBe("2026-08-11T10:00:00.000Z");
  });

  test("uses aggregate reset data when the detail request is unavailable", () => {
    const data = parseCodexUsage(
      {
        rate_limit_reset_credits: {
          available_count: 1,
          applicable_available_count: 1,
          expires_at: "2026-08-12T17:53:11.086Z",
        },
      },
      null,
    );

    expect(data.resetCreditsAvailable).toBe(1);
    expect(data.resetCreditsApplicable).toBe(1);
    expect(data.resetCreditsExpiresAt?.toISOString()).toBe("2026-08-12T17:53:11.086Z");
  });
});
