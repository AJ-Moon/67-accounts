'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Hardcoded PIN for simple cafe requirement (could be moved to .env)
const ADMIN_PIN = "6767";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const auth = localStorage.getItem('cafe_pos_auth');
    // Refresh check to prevent needing to login every single reload on shift
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem('cafe_pos_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  if (!mounted) return null;

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
      <Card className="w-96 shadow-2xl">
        <CardHeader className="text-center pb-4">
           <h1 className="text-4xl font-extrabold tracking-tighter text-amber-500 mb-2">67<span className="text-slate-900">Café</span></h1>
           <CardTitle>Staff Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
             <div className="space-y-2">
                 <Input 
                   type="password" 
                   autoFocus
                   placeholder="Enter Staff PIN" 
                   className="text-center text-xl tracking-[1em]"
                   value={pin}
                   onChange={e => setPin(e.target.value)}
                 />
                 {error && <p className="text-red-500 text-xs text-center">{error}</p>}
             </div>
             <Button type="submit" className="w-full h-12 text-lg">Unlock System</Button>
             <p className="text-center text-xs text-slate-400 mt-2">Default PIN: 6767</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
