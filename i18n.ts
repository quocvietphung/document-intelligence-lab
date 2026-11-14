import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// next-intl also loads this module outside the app directory (proxy/middleware), so it must not import
// `next/root-params`. The `[locale]` layout and pages call `setRequestLocale`, which keeps them static.
export default getRequestConfig(async ({ locale: localeOverride, requestLocale }) => {
  const requestedLocale = localeOverride ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
