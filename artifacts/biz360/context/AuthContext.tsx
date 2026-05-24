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
  user: User | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS: Record<UserRole, User> = {
  buyer: {
    id: "buyer-001",
    name: "Alex Chen",
    email: "alex@example.com",
    role: "buyer",
  },
  seller: {
    id: "seller-001",
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    role: "seller",
  },
  broker: {
    id: "broker-001",
    name: "James Harrington",
    email: "james@premiumbiz.com.au",
    role: "broker",
  },
  admin: {
    id: "admin-001",
    name: "Admin User",
    email: "admin@biz360.com.au",
    role: "admin",
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("biz360_user").then((data) => {
      if (data) {
        try {
          setUser(JSON.parse(data));
        } catch {}
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (u: User) => {
    await AsyncStorage.setItem("biz360_user", JSON.stringify(u));
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("biz360_user");
    setUser(null);
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    const updated = { ...user, role };
    await AsyncStorage.setItem("biz360_user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateRole }}>
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
