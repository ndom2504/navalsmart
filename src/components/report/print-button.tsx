"use client";

export function PrintButton() {
  return (
    <button className="h-10 rounded-md bg-navy px-4 text-sm text-white" type="button" onClick={() => window.print()}>
      PDF
    </button>
  );
}
