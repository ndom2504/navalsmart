import {
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  FolderOpen,
  GraduationCap,
  Home,
  Settings,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", short: "Accueil", icon: Home },
  { href: "/estimations", label: "Estimations", short: "Estimations", icon: ClipboardList },
  { href: "/appels-offres", label: "Appels d'offres", short: "Offres", icon: FolderOpen },
  { href: "/couts", label: "Coûts", short: "Coûts", icon: CircleDollarSign },
  { href: "/fournisseurs", label: "Fournisseurs", short: "Fourniss.", icon: Truck },
  { href: "/sous-traitants", label: "Sous-traitants", short: "Sous-tr.", icon: Users },
  { href: "/risques", label: "Risques", short: "Risques", icon: ShieldAlert },
  { href: "/rapports", label: "Rapports", short: "Rapports", icon: FileBarChart },
  { href: "/parametres", label: "Paramètres", short: "Réglages", icon: Settings },
  { href: "/cycle", label: "Cycle d'estimation", short: "Cycle", icon: GraduationCap },
];
