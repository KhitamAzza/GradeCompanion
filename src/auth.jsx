import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebase';

const Ctx = createContext({ user: null, ready: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  return <Ctx.Provider value={{ user, ready }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const login  = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logout = () => signOut(auth);