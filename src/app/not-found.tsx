import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-line-strong bg-paper-elevated px-6 py-14 text-center">
      <p className="text-5xl font-black tracking-tight text-line-strong">404</p>
      <h2 className="mt-3 text-xl font-black tracking-tight text-ink">This bit never existed.</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        The page you&apos;re looking for isn&apos;t in today&apos;s collection.
      </p>
      <Link href="/" className="mt-6">
        <Button>Back to today&apos;s feed</Button>
      </Link>
    </div>
  );
}
