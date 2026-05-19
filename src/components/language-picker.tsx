import { useTranslation } from "react-i18next";
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
