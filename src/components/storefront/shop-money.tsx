"use client";

import { createContext, useContext } from "react";
import { formatMoney } from "@/lib/utils";

const ShopMoneyContext = createContext({ currency: "EUR", locale: "en" });

export function ShopMoneyProvider({
  currency,
  locale,
  children,
}: {
  currency: string;
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <ShopMoneyContext.Provider value={{ currency, locale }}>{children}</ShopMoneyContext.Provider>
  );
}

export function useShopMoney() {
  const { currency, locale } = useContext(ShopMoneyContext);
  return (value: number) => formatMoney(value, currency, locale);
}
