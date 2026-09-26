import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-2xl font-semibold text-navy">Page introuvable</h1>
      <Link className="mt-4 inline-block text-sm text-technical" href="/dashboard">Retour au dashboard</Link>
    </div>
  );
}
