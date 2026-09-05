import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root 404. Route-group layouts don't apply here, so this screen carries its own
 * chrome and must not depend on the session.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <FileQuestionIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          That address doesn&apos;t match any screen in PeoplePay360.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Back to My Space</Link>
      </Button>
    </div>
  );
}
