import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function isModuleLoadError(error: unknown) {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|chunkloaderror/i.test(
    message,
  );
}

export function RouteErrorBoundary({
  error,
  reset,
  area = "page",
}: {
  error: Error;
  reset?: () => void;
  area?: string;
}) {
  const router = useRouter();
  const moduleFailure = isModuleLoadError(error);

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "route_error_boundary", area });
  }, [error, area]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-glass-2">
          <AlertTriangle className="h-5 w-5 text-ink-3" aria-hidden />
        </div>
        <h1 className="mt-4 page-title">
          {moduleFailure ? "This page needs a quick reload" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {moduleFailure
            ? "The app was updated while you had it open, so part of it is out of date. Reloading will pick up the latest version — nothing has been lost."
            : "Something went wrong while loading this page. Reloading usually fixes it, and your data is safe."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Reload
          </Button>
          {reset ? (
            <Button
              variant="outline"
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-muted-foreground/80">
          If this keeps happening, let your administrator know.
        </p>
      </Card>
    </div>
  );
}
