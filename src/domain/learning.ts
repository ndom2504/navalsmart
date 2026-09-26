import type { Project } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import { financialSummary, resolveLine } from "@/domain/calculations";

export function learningNotes(project: Project): Record<string, string> {
  const summary = financialSummary(project);
  return {
    importance:
      "Une information est importante lorsqu'elle change la quantité, le prix, le délai ou la responsabilité. Si elle manque, l'estimateur doit soit la demander, soit écrire une hypothèse explicite.",
    calculation: `Le coût direct de ce projet est ${formatMoney(summary.directCents, project.currency)}. Les frais indirects (${project.overheadPct} %), la provision (${project.contingencyPct} %) et la marge (${project.marginPct} %) viennent des paramètres de l'estimation, pas d'une règle figée dans le logiciel.`,
    risk:
      "Un risque n'est retenu que s'il s'appuie sur une phrase du document ou sur un constat du projet, par exemple une soumission absente. Le niveau combine la probabilité et l'impact. Il reste une appréciation de l'estimateur.",
    missing:
      "Une donnée manque lorsque le document ou les soumissions ne permettent pas de la vérifier. Il ne faut pas la remplacer par une valeur présentée comme un fait.",
    supplier:
      "Question utile à un fournisseur : quelle est la quantité retenue, le prix unitaire, la devise, la durée de validité, le délai, ce qui est inclus et ce qui est exclu ?",
    tender:
      "Dans l'appel d'offres, chercher la portée, les quantités, les unités, les délais, les documents exigés, les exclusions et les phrases du type « à confirmer » ou « non fourni ».",
    labor:
      "La main-d'œuvre se calcule ainsi : heures × taux horaire × nombre de travailleurs × facteur de productivité, plus les heures supplémentaires × taux × facteur d'heures supplémentaires. Si les heures sont déjà un total d'équipe, le nombre de travailleurs reste à 1 pour ne pas compter deux fois.",
  };
}

export function lineTeaching(project: Project, lineId: string): string {
  const line = project.lines.find((item) => item.id === lineId);
  if (!line) return "Cette ligne n'est pas dans le projet.";
  const resolved = resolveLine(project, line.id);
  return [
    `Main-d'œuvre : ${resolved.laborFormula}`,
    `Matériaux : ${resolved.materialsFormula}`,
    `Équipement : ${resolved.equipmentFormula}`,
    `Total de la ligne : ${formatMoney(resolved.directCents, project.currency)} — CALCUL SYSTÈME`,
    line.page ? `Source indiquée : page ${line.page}${line.section ? `, section ${line.section}` : ""}.` : "Aucune page de document n'est associée à cette ligne.",
    "Vérifier que chaque composante porte la bonne origine : document, utilisateur, IA ou calcul.",
  ].join(" ");
}
