export const CSB_RECIPES_ERROR_CODES = {
  authMissing: "CSB_AUTH_MISSING",
  authInvalid: "CSB_AUTH_INVALID",
  templateNotFound: "CSB_TEMPLATE_NOT_FOUND",
  sandboxStartFailed: "CSB_SANDBOX_START_FAILED",
  sandboxResumeFailed: "CSB_SANDBOX_RESUME_FAILED",
  sandboxForkFailed: "CSB_SANDBOX_FORK_FAILED",
  portFailed: "CSB_PORT_FAILED",
  portTimeout: "CSB_PORT_TIMEOUT",
  persistence: "CSB_PERSISTENCE_ERROR",
  privacyRestricted: "CSB_PRIVACY_RESTRICTED",
} as const;

export type CsbRecipesErrorCode =
  (typeof CSB_RECIPES_ERROR_CODES)[keyof typeof CSB_RECIPES_ERROR_CODES];

export type ErrorDetails = Record<string, unknown> | undefined;

export class CsbRecipesError extends Error {
  readonly code: CsbRecipesErrorCode;
  readonly details?: ErrorDetails;

  constructor(
    code: CsbRecipesErrorCode,
    message: string,
    options?: { details?: ErrorDetails; cause?: unknown }
  ) {
    super(message);
    this.name = "CsbRecipesError";
    this.code = code;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export type CsbAuthErrorKind = "missing" | "invalid";

export class CsbAuthError extends CsbRecipesError {
  readonly kind: CsbAuthErrorKind;

  constructor(
    message: string,
    details?: ErrorDetails,
    options?: { cause?: unknown; kind?: CsbAuthErrorKind }
  ) {
    const kind = options?.kind ?? "missing";
    const code =
      kind === "invalid"
        ? CSB_RECIPES_ERROR_CODES.authInvalid
        : CSB_RECIPES_ERROR_CODES.authMissing;
    super(code, message, { details, cause: options?.cause });
    this.name = "CsbAuthError";
    this.kind = kind;
  }
}

export class CsbTemplateNotFoundError extends CsbRecipesError {
  constructor(templateKey: string, details?: ErrorDetails) {
    super(
      CSB_RECIPES_ERROR_CODES.templateNotFound,
      `CodeSandbox template not found for key "${templateKey}"`,
      { details: { ...details, templateKey } }
    );
    this.name = "CsbTemplateNotFoundError";
  }
}

export class CsbSandboxStartError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails, cause?: unknown) {
    super(CSB_RECIPES_ERROR_CODES.sandboxStartFailed, message, {
      details,
      cause,
    });
    this.name = "CsbSandboxStartError";
  }
}

export class CsbSandboxResumeError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails, cause?: unknown) {
    super(CSB_RECIPES_ERROR_CODES.sandboxResumeFailed, message, {
      details,
      cause,
    });
    this.name = "CsbSandboxResumeError";
  }
}

export class CsbSandboxForkError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails, cause?: unknown) {
    super(CSB_RECIPES_ERROR_CODES.sandboxForkFailed, message, {
      details,
      cause,
    });
    this.name = "CsbSandboxForkError";
  }
}

export class CsbPortError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails, cause?: unknown) {
    super(CSB_RECIPES_ERROR_CODES.portFailed, message, { details, cause });
    this.name = "CsbPortError";
  }
}

export class CsbPortTimeoutError extends CsbRecipesError {
  constructor(
    port: number,
    timeoutMs: number,
    details?: ErrorDetails,
    cause?: unknown
  ) {
    super(
      CSB_RECIPES_ERROR_CODES.portTimeout,
      `Timed out waiting for port ${port} after ${timeoutMs}ms`,
      {
        details: { ...details, port, timeoutMs },
        cause,
      }
    );
    this.name = "CsbPortTimeoutError";
  }
}

export class CsbPersistenceError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails, cause?: unknown) {
    super(CSB_RECIPES_ERROR_CODES.persistence, message, { details, cause });
    this.name = "CsbPersistenceError";
  }
}

export class CsbPrivacyError extends CsbRecipesError {
  constructor(message: string, details?: ErrorDetails) {
    super(CSB_RECIPES_ERROR_CODES.privacyRestricted, message, { details });
    this.name = "CsbPrivacyError";
  }
}
