import { useEffect, useMemo, useState } from "react";

const PREVIEW_QUERY_KEYS = ["previewPath", "preview_path"] as const;

type PreviewMatch = {
  matches: boolean;
  remainder: string | null;
};

export function getPreviewPathFromLocation(loc: Location = window.location) {
  const searchParams = new URLSearchParams(loc.search);
  for (const key of PREVIEW_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      return value;
    }
  }
  return null;
}

export function usePreviewPath(initial?: string) {
  const [path, setPath] = useState<string | null>(() => {
    if (initial) {
      return initial;
    }
    if (typeof window !== "undefined") {
      return getPreviewPathFromLocation();
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopstate = () => {
      setPath(getPreviewPathFromLocation());
    };

    const handleMessage = (event: MessageEvent) => {
      const maybe = event.data as { type?: string; path?: unknown };
      if (maybe?.type === "preview-path" && typeof maybe.path === "string") {
        setPath(maybe.path);
      }
    };

    window.addEventListener("popstate", handlePopstate);
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return path;
}

export function usePreviewPathMatch(
  prefix: string,
  initial?: string
): PreviewMatch {
  const path = usePreviewPath(initial);

  return useMemo(() => {
    if (!path) {
      return { matches: false, remainder: null } satisfies PreviewMatch;
    }
    if (!path.startsWith(prefix)) {
      return { matches: false, remainder: null } satisfies PreviewMatch;
    }
    const remainder = path.slice(prefix.length) || "/";
    return { matches: true, remainder } satisfies PreviewMatch;
  }, [path, prefix]);
}
