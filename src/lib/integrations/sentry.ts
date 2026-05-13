/* ---------------------------------------
 * ENV CONFIG (runtime-safe)
 * ------------------------------------- */
function getSentryConfig() {
  const SENTRY_API_BASE = process.env.SENTRY_API_BASE;
  const SENTRY_API_KEY = process.env.SENTRY_API_KEY;
  const DEFAULT_TEMPLATE_ID = process.env.SENTRY_TEMPLATE_ID;

  if (!SENTRY_API_BASE || !SENTRY_API_KEY) {
    throw new Error("Missing Sentry environment variables");
  }

  return {
    SENTRY_API_BASE,
    SENTRY_API_KEY,
    DEFAULT_TEMPLATE_ID,
  };
}

/* ---------------------------------------
 * TYPES
 * ------------------------------------- */
export type VerisoulProjectSettings = {
  isEnabled?: boolean;
  shouldTermFake?: boolean;
  shouldTermSuspicious?: boolean;
};

export type SentryProjectPayload = {
  name: string;
  clientUrl: string;
  templateId: string;

  terminationUrl?: string;
  testClientUrl?: string;

  addStatusToUrl?: boolean;
  dontForwardQueryVariables?: boolean;
  skipQuestions?: boolean;

  verisoulProjectSettings?: VerisoulProjectSettings;
};

export type SentryProjectResponse = {
  project?: {
    projectId: string;
    liveUrl?: string;
    testUrl?: string;
    projectReportingUrl?: string;
    projectStatus?: string;
  };
};

/* ---------------------------------------
 * IDEMPOTENCY TOKEN
 * ------------------------------------- */
export function generateIdempotencyToken(): string {
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ---------------------------------------
 * HELPERS
 * ------------------------------------- */
function removeUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function getAppUrl() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_UI_ORIGIN;

  if (!appUrl) {
    throw new Error("Missing app URL env. Set one of NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_SITE_URL, or NEXT_PUBLIC_UI_ORIGIN");
  }

  return appUrl.replace(/\/+$/, "");
}

function getProjectKey(project: any) {
  return project.code || project.id;
}

function buildInternalSentryCallbackUrl(project: any) {
  const appUrl = getAppUrl();
  const projectKey = getProjectKey(project);

  if (!projectKey) {
    throw new Error("Missing project id/code for Sentry callback URL");
  }

  return `${appUrl}/api/projects/${encodeURIComponent(
    projectKey
  )}/sentry-callback`;
}

/* ---------------------------------------
 * BASE REQUEST
 * ------------------------------------- */
async function sentryRequest<T>(
  path: string,
  options: RequestInit & { idempotencyToken?: string } = {}
): Promise<T> {
  const { SENTRY_API_BASE, SENTRY_API_KEY } = getSentryConfig();

  const base = SENTRY_API_BASE.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": SENTRY_API_KEY,
    ...(options.headers as Record<string, string>),
  };

  if (options.idempotencyToken) {
    headers["Idempotency-Token"] = options.idempotencyToken;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Sentry API Error ${res.status}: ${text}`);
  }

  if (!text || text.trim() === "") {
    return {} as T;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from Sentry API");
  }
}

/* ---------------------------------------
 * CREATE PROJECT
 * ------------------------------------- */
export async function createSentryProject(
  payload: SentryProjectPayload
): Promise<SentryProjectResponse> {
  if (!payload.clientUrl) throw new Error("Missing clientUrl");
  if (!payload.templateId) throw new Error("Missing templateId");

  return sentryRequest<SentryProjectResponse>("/api/v1/project", {
    method: "POST",
    idempotencyToken: generateIdempotencyToken(),
    body: JSON.stringify(removeUndefined(payload)),
  });
}

/* ---------------------------------------
 * UPDATE PROJECT
 * ------------------------------------- */
export async function updateSentryProject(
  projectId: string,
  payload: Partial<SentryProjectPayload>
): Promise<SentryProjectResponse> {
  return sentryRequest<SentryProjectResponse>(
    `/api/v1/project/${projectId}`,
    {
      method: "POST",
      idempotencyToken: generateIdempotencyToken(),
      body: JSON.stringify(removeUndefined(payload)),
    }
  );
}

/* ---------------------------------------
 * GET PROJECT
 * ------------------------------------- */
export async function getSentryProject(projectId: string) {
  return sentryRequest<{ project: any }>(
    `/api/v1/project/${projectId}`,
    {
      method: "GET",
    }
  );
}

/* ---------------------------------------
 * LIST TEMPLATES
 * ------------------------------------- */
export async function listSentryTemplates() {
  return sentryRequest<{ templates: any[] }>(`/api/v1/template`, {
    method: "GET",
  });
}

/* ---------------------------------------
 * BUILD PAYLOAD (CREATE)
 * ------------------------------------- */
export function buildSentryPayload(project: any): SentryProjectPayload {
  const { DEFAULT_TEMPLATE_ID } = getSentryConfig();

  const templateId = project.sentryTemplateId || DEFAULT_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("Missing Sentry templateId");
  }

  const callbackUrl = buildInternalSentryCallbackUrl(project);

  return {
    name: project.name,
    clientUrl: callbackUrl,
    templateId,

    // Test respondents can also return to our callback.
    // This keeps test/live routing controlled by our application.
    testClientUrl: callbackUrl,

    // Sentry fail respondents should also return to our callback.
    // Our callback will route sentry_status=2/3 to the terminate flow.
    terminationUrl: callbackUrl,

    // Required for Phase 4 routing:
    // Sentry will append sentry_status=1/2/3 to callback URL.
    addStatusToUrl: true,

    // Keep forwarded params like aid, supplierId, birthDate, gender.
    dontForwardQueryVariables: false,

    skipQuestions: false,

    verisoulProjectSettings: {
      isEnabled: project.sentryVerisoulEnabled ?? false,
      shouldTermFake: project.sentryVerisoulTermFake ?? false,
      shouldTermSuspicious:
        project.sentryVerisoulTermSuspicious ?? false,
    },
  };
}

/* ---------------------------------------
 * BUILD PAYLOAD (UPDATE)
 * ------------------------------------- */
export function buildSentryUpdatePayload(project: any) {
  const callbackUrl = buildInternalSentryCallbackUrl(project);

  return {
    name: project.name,

    clientUrl: callbackUrl,
    testClientUrl: callbackUrl,
    terminationUrl: callbackUrl,

    addStatusToUrl: true,
    dontForwardQueryVariables: false,
    skipQuestions: false,

    verisoulProjectSettings: {
      isEnabled: project.sentryVerisoulEnabled ?? false,
      shouldTermFake: project.sentryVerisoulTermFake ?? false,
      shouldTermSuspicious:
        project.sentryVerisoulTermSuspicious ?? false,
    },
  };
}