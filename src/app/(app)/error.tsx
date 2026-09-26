"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <h1 className="text-lg font-semibold text-navy">Le dossier n&apos;a pas pu être affiché.</h1>
      <button className="mt-4 h-10 rounded-md bg-navy px-4 text-sm text-white" type="button" onClick={reset}>Réessayer</button>
    </div>
  );
}
