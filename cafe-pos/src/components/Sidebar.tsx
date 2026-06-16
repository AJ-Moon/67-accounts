'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, LayoutDashboard, Settings, ShoppingCart, ListOrdered, FileText, ArrowLeftRight, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole() {
       const supabase = createClient();
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
          const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
          if (data) setRole(data.role);
       }
    }
    loadRole();
  }, [pathname]);

  if (pathname === '/login') return null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const routes = [
    { label: 'New Order', icon: ShoppingCart, href: '/', roles: ['admin', 'desk', 'outside'] },
    { label: 'Orders', icon: ListOrdered, href: '/orders', roles: ['admin', 'desk', 'outside'] },
    { label: 'Menu Items', icon: Coffee, href: '/menu', roles: ['admin', 'desk', 'outside'] },
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin'] },
    { label: 'Accounts / Ledger', icon: ArrowLeftRight, href: '/accounts', roles: ['admin'] },
    { label: 'Reports', icon: FileText, href: '/reports', roles: ['admin', 'desk'] },
    { label: 'Settings', icon: Settings, href: '/settings', roles: ['admin'] },
  ].filter(r => !role || r.roles.includes(role));

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 hidden md:flex h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tighter text-amber-400">67<span className="text-white">Café</span></h1>
        <p className="text-slate-400 text-sm mt-1 flex items-center justify-between">
          <span>POS & Billing</span>
          {role && <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{role}</span>}
        </p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto pb-4">
        {routes.map((route) => {
          const isActive = pathname === route.href || (pathname.startsWith(route.href) && route.href !== '/');
          
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                isActive 
                ? 'bg-amber-500/10 text-amber-400 font-medium' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <route.icon className="h-5 w-5" />
              {route.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
           onClick={handleLogout}
           className="flex items-center w-full gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
