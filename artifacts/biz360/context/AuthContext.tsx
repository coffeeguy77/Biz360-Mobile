import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "buyer" | "seller" | "broker" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user:          User | null;
  realUser:      User | null;   // phone-verified account (survives demo switching)
  isLoading:     boolean;
  login:         (user: User) => Promise<void>;     // demo switch — never overwrites realUser
  loginAsReal:   (user: User) => Promise<void>;     // phone auth — saves as realUser too
  restoreReal:   () => Promise<void>;               // switch back to realUser from a demo session
  logout:        () => Promise<void>;               // full sign-out, clears everything
  updateRole:    (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CURRENT_KEY = "biz360_user";
const REAL_KEY    = "biz360_real_user";

const DEMO_USERS: Record<UserRole, User> = {
  buyer: {
    id:    "buyer-001",
    name:  "Alex Chen",
    email: "alex@example.com",
    role:  "buyer",
  },
  seller: {
    id:    "seller-001",
    name:  "Sarah Mitchell",
    email: "sarah@example.com",
    role:  "seller",
  },
  broker: {
    id:    "broker-001",
    name:  "James Harrington",
    email: "james@premiumbiz.com.au",
    role:  "broker",
  },
  admin: {
    id:    "admin-001",
    name:  "Admin User",
    email: "admin@biz360.com.au",
    role:  "admin",
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [realUser,  setRealUser]  = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CURRENT_KEY),
      AsyncStorage.getItem(REAL_KEY),
    ]).then(([cur, real]) => {
      try { if (cur)  setUser(JSON.parse(cur));      } catch {}
      try { if (real) setRealUser(JSON.parse(real)); } catch {}
      setIsLoading(false);
    });
  }, []);

  // Demo switch — sets current user but never touches the realUser store
  const login = async (u: User) => {
    await AsyncStorage.setItem(CURRENT_KEY, JSON.stringify(u));
    setUser(u);
  };

  // Phone-verified login — saves as both current AND real user
  const loginAsReal = async (u: User) => {
    await Promise.all([
      AsyncStorage.setItem(CURRENT_KEY, JSON.stringify(u)),
      AsyncStorage.setItem(REAL_KEY,    JSON.stringify(u)),
    ]);
    setUser(u);
    setRealUser(u);
  };

  // Restore the phone-verified account after a demo session
  const restoreReal = async () => {
    if (!realUser) return;
    await AsyncStorage.setItem(CURRENT_KEY, JSON.stringify(realUser));
    setUser(realUser);
  };

  // Full sign-out — removes everything
  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem(CURRENT_KEY),
      AsyncStorage.removeItem(REAL_KEY),
    ]);
    setUser(null);
    setRealUser(null);
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    const updated = { ...user, role };
    await AsyncStorage.setItem(CURRENT_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, realUser, isLoading, login, loginAsReal, restoreReal, logout, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { DEMO_USERS };
