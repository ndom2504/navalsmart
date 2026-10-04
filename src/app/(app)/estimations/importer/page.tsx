import Link from "next/link";
import { TenderImport } from "@/components/estimation/tender-import";

export const metadata = { title: "Nouvelle estimation depuis un appel d'offres" };

export default function ImportTenderPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Nouvelle estimation depuis un appel d&apos;offres</h1>
        <p className="mt-1 text-sm text-steel">
          Déposez le document : l&apos;estimation est créée et préremplie avec les informations du projet, ses lots, ses jalons et ses ordres de travail.
        </p>
      </div>
      <TenderImport />
      <p className="text-sm text-steel">
        Vous préférez saisir le dossier vous-même ? <Link href="/estimations/nouvelle" className="font-medium text-[#1d6fe0]">Créer une estimation vide</Link>
      </p>
    </div>
  );
}
