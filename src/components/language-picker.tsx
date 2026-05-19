import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LOCALES } from "@/i18n";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  ja: "日本語",
  zh: "中文",
  ar: "العربية",
  ru: "Русский",
  pl: "Polski",
};

const RTL_LOCALES = new Set(["ar"]);

function baseLang(lng: string | undefined): string {
  if (!lng) return "en";
  const base = lng.toLowerCase().split("-")[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? base : "en";
}

export function LanguagePicker({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = baseLang(i18n.resolvedLanguage ?? i18n.language);

  // Re-runs on every TanStack navigation (pushState/replaceState/popstate)
  const urlLng = useRouterState({
    select: (s) => {
      const search = s.location.search as Record<string, unknown> | undefined;
      const fromSearch = search && typeof search.lng === "string" ? search.lng : undefined;
      if (fromSearch) return fromSearch;
      if (typeof window === "undefined") return undefined;
      return new URL(window.location.href).searchParams.get("lng") ?? undefined;
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!urlLng) return;
    const next = baseLang(urlLng);
    if (next !== baseLang(i18n.resolvedLanguage ?? i18n.language)) {
      void i18n.changeLanguage(next).then(() => {
        document.documentElement.lang = next;
        document.documentElement.dir = RTL_LOCALES.has(next) ? "rtl" : "ltr";
      });
    }
  }, [urlLng, i18n]);

  // Browser back/forward when the URL was changed outside the router
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromUrl = () => {
      const lng = new URL(window.location.href).searchParams.get("lng");
      if (!lng) return;
      const next = baseLang(lng);
      if (next !== baseLang(i18n.resolvedLanguage ?? i18n.language)) {
        void i18n.changeLanguage(next).then(() => {
          document.documentElement.lang = next;
          document.documentElement.dir = RTL_LOCALES.has(next) ? "rtl" : "ltr";
        });
      }
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [i18n]);

  const handleChange = async (value: string) => {
    await i18n.changeLanguage(value);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("i18nextLng", value);
      } catch {
        // ignore quota / privacy errors
      }
      const url = new URL(window.location.href);
      url.searchParams.set("lng", value);
      window.history.replaceState({}, "", url.toString());
      document.documentElement.lang = value;
      document.documentElement.dir = RTL_LOCALES.has(value) ? "rtl" : "ltr";
    }
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger
        className={className ?? "h-9 w-auto min-w-[8.5rem] gap-2"}
        aria-label="Select language"
      >
        <Globe className="h-4 w-4 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(SUPPORTED_LOCALES as readonly string[]).map((code) => (
          <SelectItem key={code} value={code}>
            {LANGUAGE_LABELS[code] ?? code.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default LanguagePicker;
