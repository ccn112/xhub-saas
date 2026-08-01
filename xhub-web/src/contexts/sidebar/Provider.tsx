"use client";

import { ReactNode, useEffect, useLayoutEffect } from "react";

import { useDisclosure } from "@/hooks/useDisclosure";
import { useDidUpdate } from "@/hooks/useDidUpdate";
import { useBreakpointsContext } from "../breakpoint/context";
import { SidebarContext, SidebarContextValue } from "./context";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const { xlAndUp, lgAndDown, name } = useBreakpointsContext();

  // Start collapsed so the server-rendered markup matches the client's first
  // render (breakpoints are unknown during SSR); expand on mount for wide screens.
  const [isExpanded, { open, close, toggle }] = useDisclosure(false);

  useEffect(() => {
    if (xlAndUp) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDidUpdate(() => {
    if (lgAndDown) {
      close();
    }
  }, [name]);

  useLayoutEffect(() => {
    const documentBody = typeof document !== "undefined" ? document.body : null;
    if (documentBody) {
      if (isExpanded) {
        documentBody.classList.add("is-sidebar-open");
      } else {
        documentBody.classList.remove("is-sidebar-open");
      }
    }
  }, [isExpanded]);

  if (!children) {
    return null;
  }

  return (
    <SidebarContext
      value={{
        isExpanded,
        toggle,
        open,
        close,
      }}
    >
      {children}
    </SidebarContext>
  );
}
