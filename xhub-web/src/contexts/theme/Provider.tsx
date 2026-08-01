"use client";

import { ReactNode, useLayoutEffect } from "react";

// Local Imports
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ThemeContext, type ThemeContextValue } from "./context";
import {
  CardSkin,
  DarkColor,
  IsMonochrome,
  LightColor,
  Notification,
  PrimaryColor,
  ThemeConfig,
  ThemeLayout,
  ThemeMode,
} from "@/configs/@types/theme";
import { defaultTheme } from "@/configs/theme";
import { colors } from "@/constants/colors";

// ----------------------------------------------------------------------

const initialState: ThemeContextValue = {
  ...defaultTheme,
  setThemeMode: () => {},
  setThemeLayout: () => {},
  setMonochromeMode: () => {},
  setCardSkin: () => {},
  setLightColorScheme: () => {},
  setDarkColorScheme: () => {},
  setPrimaryColorScheme: () => {},
  setNotificationPosition: () => {},
  setNotificationExpand: () => {},
  setNotificationMaxCount: () => {},
  resetTheme: () => {},
  isDark: false,
  setSettings: () => {},
};

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

// Safe getter for the <html> element (undefined during SSR).
function getHtml(): HTMLElement | null {
  return typeof document !== "undefined" ? document.documentElement : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);

  const [settings, setSettings] = useLocalStorage<ThemeConfig>("settings", {
    themeMode: initialState.themeMode,
    themeLayout: initialState.themeLayout,
    cardSkin: initialState.cardSkin,
    isMonochrome: initialState.isMonochrome,
    darkColorScheme: initialState.darkColorScheme,
    lightColorScheme: initialState.lightColorScheme,
    primaryColorScheme: initialState.primaryColorScheme,
    notification: { ...initialState.notification },
  });

  const isDark =
    (settings.themeMode === "system" && isDarkOS) ||
    settings.themeMode === "dark";

  const setThemeMode = (val: ThemeMode) => {
    setSettings((prev) => ({ ...prev, themeMode: val }));
  };

  const setThemeLayout = (val: ThemeLayout) => {
    setSettings((prev) => ({ ...prev, themeLayout: val }));
  };

  const setMonochromeMode = (val: IsMonochrome) => {
    setSettings((prev) => ({ ...prev, isMonochrome: val }));
  };

  const setDarkColorScheme = (val: DarkColor) => {
    setSettings((prev) => ({
      ...prev,
      darkColorScheme: { name: val, ...colors[val] },
    }));
  };

  const setLightColorScheme = (val: LightColor) => {
    setSettings((prev) => ({
      ...prev,
      lightColorScheme: { name: val, ...colors[val] },
    }));
  };

  const setPrimaryColorScheme = (val: PrimaryColor) => {
    setSettings((prev) => ({
      ...prev,
      primaryColorScheme: {
        name: val,
        ...(val === "default" ? colors.blue : colors[val]),
      },
    }));
  };

  const setNotificationPosition = (val: Notification["position"]) => {
    setSettings((prev) => ({
      ...prev,
      notification: { ...prev.notification, position: val },
    }));
  };

  const setNotificationExpand = (val: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notification: { ...prev.notification, isExpanded: val },
    }));
  };

  const setNotificationMaxCount = (val: number) => {
    setSettings((prev) => ({
      ...prev,
      notification: { ...prev.notification, visibleToasts: val },
    }));
  };

  const setCardSkin = (val: CardSkin) => {
    setSettings((prev) => ({ ...prev, cardSkin: val }));
  };

  const resetTheme = () => {
    setSettings({
      themeMode: initialState.themeMode,
      themeLayout: initialState.themeLayout,
      isMonochrome: initialState.isMonochrome,
      darkColorScheme: initialState.darkColorScheme,
      lightColorScheme: initialState.lightColorScheme,
      primaryColorScheme: initialState.primaryColorScheme,
      cardSkin: initialState.cardSkin,
      notification: { ...initialState.notification },
    });
  };

  useLayoutEffect(() => {
    const html = getHtml();
    if (!html) return;
    if (isDark) html.classList.add("dark");
    else html.classList.remove("dark");
  }, [isDark]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    if (settings.isMonochrome) document.body.classList.add("is-monochrome");
    else document.body.classList.remove("is-monochrome");
  }, [settings.isMonochrome]);

  useLayoutEffect(() => {
    const html = getHtml();
    if (html) html.dataset.themeLight = settings.lightColorScheme.name;
  }, [settings.lightColorScheme]);

  useLayoutEffect(() => {
    const html = getHtml();
    if (html) html.dataset.themeDark = settings.darkColorScheme.name;
  }, [settings.darkColorScheme]);

  useLayoutEffect(() => {
    const html = getHtml();
    if (!html) return;
    // "default" keeps the brand primary from globals.css (@theme).
    if (settings.primaryColorScheme.name === "default") {
      delete html.dataset.themePrimary;
    } else {
      html.dataset.themePrimary = settings.primaryColorScheme.name;
    }
  }, [settings.primaryColorScheme]);

  useLayoutEffect(() => {
    const html = getHtml();
    if (html) html.dataset.cardSkin = settings.cardSkin;
  }, [settings.cardSkin]);

  useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.layout = settings.themeLayout;
    }
  }, [settings.themeLayout]);

  if (!children) {
    return null;
  }

  const contextValue: ThemeContextValue = {
    ...settings,
    isDark,
    setMonochromeMode,
    setThemeMode,
    setThemeLayout,
    setLightColorScheme,
    setDarkColorScheme,
    setPrimaryColorScheme,
    setNotificationPosition,
    setNotificationExpand,
    setNotificationMaxCount,
    setCardSkin,
    setSettings,
    resetTheme,
  };

  return <ThemeContext value={contextValue}>{children}</ThemeContext>;
}
