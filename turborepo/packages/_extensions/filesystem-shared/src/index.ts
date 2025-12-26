export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

const TRAILING_SLASH_REGEX = /\/+$/;

export function getParentDirectory(path: string | null | undefined) {
  if (!path || path === ".") {
    return ".";
  }

  const normalized = path.replace(TRAILING_SLASH_REGEX, "");
  if (!normalized || normalized === ".") {
    return ".";
  }

  const segments = normalized.split("/");
  if (segments.length <= 1) {
    return ".";
  }

  segments.pop();
  const parent = segments.join("/");
  return parent === "" ? "." : parent;
}
