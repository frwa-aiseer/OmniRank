import React, { createContext, useContext, useState, ReactNode } from "react";
import { AppView, Organization, Brand, UserProfile } from "../types/index.ts";

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  currentOrg: Organization;
  setCurrentOrg: (org: Organization) => void;
  currentBrand: Brand;
  setCurrentBrand: (brand: Brand) => void;
  currentUser: UserProfile;
}

const defaultOrg: Organization = {
  id: "org-default-01",
  name: "Acme Growth Corp",
  slug: "acme-growth",
  createdAt: "2026-01-01T00:00:00Z",
};

const defaultBrand: Brand = {
  id: "brand-default-01",
  organizationId: "org-default-01",
  name: "ApexCloud",
  slug: "apexcloud",
  primaryDomain: "https://apexcloud.example.com",
  createdAt: "2026-01-01T00:00:00Z",
};

const defaultUser: UserProfile = {
  id: "usr-default-01",
  email: "strategist@apexcloud.example.com",
  fullName: "Alex Rivera",
  orgRole: "owner",
  brandRole: "strategist",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [currentOrg, setCurrentOrg] = useState<Organization>(defaultOrg);
  const [currentBrand, setCurrentBrand] = useState<Brand>(defaultBrand);
  const [currentUser] = useState<UserProfile>(defaultUser);

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        currentOrg,
        setCurrentOrg,
        currentBrand,
        setCurrentBrand,
        currentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
