"use client";

// Shared app shell: header + main content + the mode-driven navigation +
// the personal-settings drawer. Navigation content changes by mode; the shell
// (header, main, footer) stays identical between XHub and X.Space.
//
// Full-height layout (dvh, no hardcoded px): the shell is a flex column that
// fills the viewport — Header (fixed height, top) · main (flex-1, min-h-0,
// scrolls its own overflow) · Footer (bottom, never pushed by long content).
// The sidebar renderers are `fixed`; Header/main/Footer are shifted right by
// the sidebar width via the `.app-header` / `main.main-content` / `.app-footer`
// offset rules in layouts.css + navigation.css.
import clsx from "clsx";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/MainLayout/Header";
import { Footer } from "@/components/layout/Footer";
import { NavigationModeRenderer } from "./NavigationModeRenderer";
import { SettingsDrawer } from "./SettingsDrawer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex h-dvh flex-col">
        <Header />
        <main className={clsx("main-content transition-content min-h-0 flex-1 overflow-y-auto")}>
          <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-5 lg:px-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>
      <NavigationModeRenderer />
      <SettingsDrawer />
    </>
  );
}
