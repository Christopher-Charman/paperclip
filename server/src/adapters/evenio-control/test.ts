import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";

const HEALTH_URL = "http://127.0.0.1:18180/health";
const TOKEN_ENV = "EVENIO_DELEGATION_TOKEN";
const MAX_WRITE_BYTES = 128 * 1024;

function summarize(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const token = process.env[TOKEN_ENV]?.trim() ?? "";
  const rawBudget = ctx.config.maxWriteBytes;
  const budget =
    rawBudget === undefined || rawBudget === null || rawBudget === ""
      ? 64 * 1024
      : typeof rawBudget === "number"
        ? rawBudget
        : Number(rawBudget);

  if (token.length < 32) {
    checks.push({
      code: "evenio_delegation_token_missing",
      level: "error",
      message: `${TOKEN_ENV} is missing or too short.`,
      hint: "Expose the dedicated Evenio delegation token only to the Paperclip server process.",
    });
  } else {
    checks.push({
      code: "evenio_delegation_token_present",
      level: "info",
      message: "Dedicated Evenio delegation credential is present.",
    });
  }

  if (!Number.isInteger(budget) || budget < 1 || budget > MAX_WRITE_BYTES) {
    checks.push({
      code: "evenio_max_write_bytes_invalid",
      level: "error",
      message: `maxWriteBytes must be an integer between 1 and ${MAX_WRITE_BYTES}.`,
    });
  } else {
    checks.push({
      code: "evenio_max_write_bytes_valid",
      level: "info",
      message: `Delegated handoff ceiling: ${budget} bytes.`,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(HEALTH_URL, { signal: controller.signal });
    checks.push({
      code: response.ok ? "evenio_loopback_health_ok" : "evenio_loopback_health_failed",
      level: response.ok ? "info" : "error",
      message: response.ok
        ? "Evenio loopback control API is reachable."
        : `Evenio health endpoint returned HTTP ${response.status}.`,
    });
  } catch (error) {
    checks.push({
      code: "evenio_loopback_health_unreachable",
      level: "error",
      message: error instanceof Error ? error.message : "Evenio loopback control API is unreachable.",
    });
  } finally {
    clearTimeout(timer);
  }

  return {
    adapterType: ctx.adapterType,
    status: summarize(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
