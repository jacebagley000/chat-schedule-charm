import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import it from "./locales/it.json";
import nl from "./locales/nl.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";
import ru from "./locales/ru.json";
import pl from "./locales/pl.json";

export const SUPPORTED_LOCALES = [
  "en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ar", "ru", "pl",
] as const;

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
        pt: { translation: pt },
        it: { translation: it },
        nl: { translation: nl },
        ja: { translation: ja },
        zh: { translation: zh },
        ar: { translation: ar },
        ru: { translation: ru },
        pl: { translation: pl },
      },
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      detection: {
        order: ["querystring", "localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
      },
      returnNull: false,
    });
}

export default i18n;
