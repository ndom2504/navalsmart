import { CycleGuide } from "@/components/cycle/cycle-guide";

export const metadata = { title: "Cycle de l'estimation" };

export default function CyclePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Le cycle de l&apos;estimation</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-steel">
          Parcours de formation. Ces repères décrivent le raisonnement d&apos;un estimateur. Ils ne reproduisent aucune règle interne d&apos;une entreprise réelle.
        </p>
      </div>
      <CycleGuide />
    </div>
  );
}
