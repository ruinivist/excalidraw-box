import { useEffect, useState } from "react";
import { type PublicDrawing } from "../../core/shared";

type PublicDrawingState = {
  drawing: PublicDrawing | null;
  loading: boolean;
  error: string | null;
};

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requestPublicDrawing(slug: string): Promise<PublicDrawing> {
  const response = await fetch(`/api/public/drawings/${encodeURIComponent(slug)}`);
  const body = (await response.json()) as PublicDrawing & { error?: string };

  if (!response.ok) {
    throw new RequestError(response.status, body.error ?? `Request failed: ${response.status}`);
  }

  return body;
}

export function usePublicDrawing(slug: string): PublicDrawingState {
  const [drawing, setDrawing] = useState<PublicDrawing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void requestPublicDrawing(slug)
      .then((nextDrawing) => {
        if (cancelled) {
          return;
        }

        setDrawing(nextDrawing);
        document.title = nextDrawing.title;
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setDrawing(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load drawing");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    drawing,
    loading,
    error,
  };
}
