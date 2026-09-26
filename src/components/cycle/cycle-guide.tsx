"use client";

import { useState } from "react";
import { cycleSteps } from "@/domain/cycle";

export function CycleGuide() {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const step = cycleSteps[current];
  if (!step) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ol className="space-y-1">
        {cycleSteps.map((item, index) => (
          <li key={item.id}>
            <button type="button" onClick={() => setCurrent(index)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${index === current ? "bg-navy text-white" : "hover:bg-white"}`}>
              {index + 1}. {item.title}
            </button>
          </li>
        ))}
      </ol>
      <article className="space-y-4 rounded-lg border border-line bg-card p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan">Étape {current + 1} / {cycleSteps.length}</p>
        <h2 className="text-2xl font-semibold text-navy">{step.title}</h2>
        <p>{step.objective}</p>
        <div>
          <h3 className="font-medium text-navy">Questions de l&apos;estimateur</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{step.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </div>
        <p className="text-sm"><span className="font-medium text-navy">Dans l&apos;appel d&apos;offres : </span>{step.lookFor}</p>
        <p className="text-sm"><span className="font-medium text-navy">Effet sur le prix : </span>{step.effect}</p>
        <p className="text-sm"><span className="font-medium text-navy">Erreur fréquente : </span>{step.mistake}</p>
        <p className="rounded-md bg-background p-3 text-sm text-steel">{step.role}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={done.includes(step.id)}
            onChange={(event) => setDone(event.target.checked ? [...done, step.id] : done.filter((item) => item !== step.id))}
          />
          J&apos;ai revu cette étape
        </label>
        <div className="flex gap-2">
          <button className="h-10 rounded-md border border-line px-4 text-sm" type="button" disabled={current === 0} onClick={() => setCurrent(current - 1)}>Précédent</button>
          <button className="h-10 rounded-md bg-navy px-4 text-sm text-white" type="button" disabled={current === cycleSteps.length - 1} onClick={() => setCurrent(current + 1)}>Suivant</button>
        </div>
      </article>
    </div>
  );
}
