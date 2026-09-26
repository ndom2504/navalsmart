"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Boxes, Eye, EyeOff, FileText, Globe, Lock, Mail, ShieldCheck, Ship, Users } from "lucide-react";
import { loginAction } from "@/server/login";

const features = [
  {
    icon: FileText,
    title: "Analyse intelligente",
    text: "Extraction automatique des informations clés de vos appels d'offres.",
  },
  {
    icon: Boxes,
    title: "Estimation structurée",
    text: "Décomposition en lots de travaux avec quantités et coûts.",
  },
  {
    icon: ShieldCheck,
    title: "Risques et hypothèses",
    text: "Identification des risques, contraintes et informations manquantes.",
  },
  {
    icon: BarChart3,
    title: "Rapports professionnels",
    text: "Générez des rapports d'estimation complets et personnalisables.",
  },
];

const stats = [
  { icon: Ship, value: "+ 200", label: "Projets estimés" },
  { icon: Users, value: "+ 50", label: "Entreprises clientes" },
  { icon: Globe, value: "+ 15", label: "Pays" },
];

export function LoginScreen({ email, demoPassword, error }: { email: string; demoPassword: string; error: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061426] text-white">
      <img src="/brand/shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(4,18,40,0.9)_0%,rgba(7,32,62,0.72)_36%,rgba(8,42,82,0.28)_64%,rgba(5,20,40,0.12)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_78%,rgba(56,160,214,0.18),transparent_34%)]" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,0.88fr)]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="flex items-center gap-3">
            <img src="/brand/mark.png" alt="" className="h-14 w-auto sm:h-16" />
            <div>
              <img src="/brand/wordmark.png" alt="NavalSmart — AI-Powered Naval Estimation" className="h-10 w-auto brightness-0 invert sm:h-12" />
            </div>
          </div>

          <div className="max-w-xl py-10 lg:py-0">
            <span className="mb-5 block h-1 w-16 rounded-full bg-[#3ec6e0]" />
            <h1 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              De l&apos;appel d&apos;offres
              <br />
              à l&apos;estimation,
              <br />
              avec <span className="text-[#7ee7f5]">l&apos;IA.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/80 sm:text-base">
              Un outil professionnel pour analyser, structurer et estimer vos projets de construction et réparation navales.
            </p>
            <ul className="mt-8 hidden max-w-md space-y-4 md:block">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{feature.title}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-white/70">{feature.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <dl className="hidden items-center gap-5 border-t border-white/15 pt-5 pb-1 md:flex">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-6">
                  {index > 0 ? <span className="h-10 w-px bg-white/20" /> : null}
                  <div className="flex items-center gap-3">
                    <Icon className="h-7 w-7 text-white/85" strokeWidth={1.5} />
                    <div>
                      <dt className="text-lg font-semibold leading-none">{stat.value}</dt>
                      <dd className="mt-1 text-xs whitespace-nowrap text-white/70">{stat.label}</dd>
                    </div>
                  </div>
                </div>
              );
            })}
          </dl>
        </section>

        <section className="relative min-h-screen text-foreground">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#e8eef5] lg:[clip-path:polygon(92px_0,100%_0,100%_100%,0_100%)] lg:[filter:drop-shadow(-18px_0_24px_rgba(3,12,28,0.28))]" />
          <div className="relative z-20 flex min-h-screen flex-col">
          <div className="flex justify-end px-6 pt-6 lg:px-10">
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3 text-xs font-medium text-steel shadow-sm"
                aria-expanded={languageOpen}
                onClick={() => setLanguageOpen((open) => !open)}
              >
                <Globe className="h-3.5 w-3.5" />
                FR
                <span className="text-[10px]">▼</span>
              </button>
              {languageOpen ? (
                <p className="absolute right-0 z-10 mt-2 w-36 rounded-lg border border-line bg-white px-3 py-2 text-xs text-navy shadow-lg">
                  Français
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:pl-16 lg:pr-10">
            <div className="relative z-20 w-full max-w-[460px] rounded-2xl bg-white px-7 py-8 shadow-[0_22px_50px_rgba(11,31,58,0.18)] ring-1 ring-white sm:px-8 lg:-translate-x-6">
              <p className="text-center text-sm text-steel">Bienvenue sur</p>
              <img src="/brand/logo-lockup.png" alt="NavalSmart — AI-Powered Naval Estimation" className="mx-auto mt-3 h-[72px] w-auto" />
              <p className="mt-4 text-center text-sm text-steel">Connectez-vous à votre espace de travail.</p>

              <form action={loginAction} className="mt-8 space-y-4">
                {error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">Courriel ou mot de passe incorrect.</p>
                ) : null}
                {notice ? <p className="rounded-lg border border-line bg-[#f4f7fb] px-3 py-2 text-sm leading-5 text-navy">{notice}</p> : null}

                <label className="block text-sm font-medium text-navy" htmlFor="email">
                  Adresse courriel
                  <span className="relative mt-1.5 block">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                      defaultValue={email}
                      className="h-12 w-full rounded-lg border border-[#d7dee7] bg-white pr-3 pl-10 text-sm outline-none focus:border-technical"
                    />
                  </span>
                </label>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <label className="font-medium text-navy" htmlFor="password">Mot de passe</label>
                    <button
                      type="button"
                      className="text-xs font-medium text-[#1d6fe0]"
                      onClick={() => setNotice(`Session de formation : ${email}. Mot de passe : ${demoPassword}`)}
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <span className="relative block">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className="h-12 w-full rounded-lg border border-[#d7dee7] bg-white pr-11 pl-10 text-sm outline-none focus:border-technical"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-steel"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </div>

                <label className="flex items-center gap-2 text-sm text-navy">
                  <input name="remember" type="checkbox" defaultChecked className="h-4 w-4 accent-[#123a66]" />
                  Se souvenir de moi
                </label>

                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(180deg,#16345c_0%,#0d2748_100%)] text-sm font-semibold text-white shadow-sm"
                >
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-steel">
                <span className="h-px flex-1 bg-line" />
                ou continuer avec
                <span className="h-px flex-1 bg-line" />
              </div>

              <button
                type="button"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#d7dee7] bg-white text-sm font-medium text-navy"
                onClick={() => setNotice("La connexion Microsoft n'est pas activée sur cette session. Utilisez l'adresse courriel.")}
              >
                <MicrosoftMark />
                Continuer avec Microsoft
              </button>

              <p className="mt-6 text-center text-sm text-steel">
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  className="font-medium text-[#1d6fe0]"
                  onClick={() => setNotice("La création de compte est fermée sur cette session de formation. Connectez-vous avec le compte Morel.")}
                >
                  Créer un compte
                </button>
              </p>
            </div>
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#F25022" d="M1 1h6.5v6.5H1z" />
      <path fill="#7FBA00" d="M8.5 1H15v6.5H8.5z" />
      <path fill="#00A4EF" d="M1 8.5h6.5V15H1z" />
      <path fill="#FFB900" d="M8.5 8.5H15V15H8.5z" />
    </svg>
  );
}
