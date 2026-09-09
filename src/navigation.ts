import { useEffect, useState } from "react";
import type { Page } from "./types";
export const routePages = [
  "overview",
  "twin",
  "energy",
  "logistics",
  "environment",
  "maintenance",
  "scenarios",
  "evidence",
  "operations",
  "research",
] as const;
export function readRoute() {
  const u = new URL(location.href),
    bits = u.pathname.split("/").filter(Boolean);
  const valid =
    bits[0] === "stations" && ["maitri", "bharati"].includes(bits[1]);
  const section = valid ? bits[2] : "overview";
  let decoded = "";
  try {
    decoded = decodeURIComponent(bits[3] || "");
  } catch {
    /* Malformed URLs get an unavailable state. */
  }
  const detail = ["assets", "alerts", "work-orders", "shipments"].includes(
    section,
  )
    ? { kind: section, id: decoded }
    : null;
  const page: Page = detail
    ? section === "assets"
      ? "twin"
      : section === "shipments"
        ? "logistics"
        : "maintenance"
    : routePages.includes(section as Page)
      ? (section as Page)
      : "overview";
  const mode = u.searchParams.get("mode");
  const workspace =
    mode === "operational"
      ? "operational"
      : mode === "private"
        ? sessionStorage.getItem("polaris-active-workspace") || "browser-demo"
        : "demo";
  return {
    page,
    station: valid ? bits[1] : "maitri",
    workspace,
    detail,
    invalid:
      u.pathname !== "/" &&
      (!valid ||
        (!detail && !routePages.includes(section as Page)) ||
        (!!detail && !decoded) ||
        bits.length > (detail ? 4 : 3)),
  };
}
export function routeHref(page: Page, station: string, workspace: string) {
  const q = new URLSearchParams(location.search);
  q.set(
    "mode",
    workspace === "operational"
      ? "operational"
      : workspace === "demo"
        ? "demo"
        : "private",
  );
  return `/stations/${station}/${page}?${q}`;
}
export function useNavigation() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener("popstate", update);
    if (location.pathname === "/")
      history.replaceState(
        {},
        "",
        routeHref(route.page, route.station, route.workspace),
      );
    return () => window.removeEventListener("popstate", update);
  }, []);
  function navigate(
    page: Page,
    station = readRoute().station,
    workspace = readRoute().workspace,
    detail?: { kind: string; id: string },
  ) {
    let href = routeHref(page, station, workspace);
    if (detail)
      href = href.replace(
        "/" + page + "?",
        `/${detail.kind}/${encodeURIComponent(detail.id)}?`,
      );
    if (href !== location.pathname + location.search) {
      history.pushState({}, "", href);
      setRoute(readRoute());
    }
  }
  return {
    ...route,
    navigate,
    setPage: (page: Page) => navigate(page),
    setStation: (station: string) => navigate(readRoute().page, station),
    setWorkspace: (workspace: string) => {
      if (workspace !== "demo" && workspace !== "operational")
        sessionStorage.setItem("polaris-active-workspace", workspace);
      navigate(readRoute().page, readRoute().station, workspace);
    },
    openDetail: (kind: string, id: string) =>
      navigate(
        kind === "assets"
          ? "twin"
          : kind === "shipments"
            ? "logistics"
            : "maintenance",
        undefined,
        undefined,
        { kind, id },
      ),
  };
}
