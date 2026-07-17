'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, KeyRound, UserCog } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin — full access' },
  { value: 'manager', label: 'Manager — reports, inventory, orders' },
  { value: 'cashier', label: 'Cashier — billing & orders' },
  { value: 'kitchen', label: 'Kitchen — KDS screens only' },
];

type Profile = { id: string; role: string; display_name?: string; email?: string | null; created_at: string };

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Profile | null>(null);

  const load = useCallback(() => {
    fetch('/api/users').then(async r => {
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Failed to load'); setLoading(false); return; }
      setUsers(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'), password: fd.get('password'),
        displayName: fd.get('displayName'), role: fd.get('role'),
      }),
    });
    const j = await res.json();
    if (res.ok) { toast.success('User created'); setCreateOpen(false); load(); }
    else toast.error(j.error || 'Failed to create user');
  };

  const changeRole = async (id: string, role: string) => {
    const res = await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    });
    const j = await res.json();
    if (res.ok) { toast.success('Role updated'); load(); }
    else toast.error(j.error || 'Failed');
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetFor) return;
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetFor.id, password: fd.get('password') }),
    });
    const j = await res.json();
    if (res.ok) { toast.success('Password updated'); setResetFor(null); }
    else toast.error(j.error || 'Failed');
  };

  const roleBadge = (role: string) => ({
    admin: 'bg-purple-100 text-purple-700', manager: 'bg-blue-100 text-blue-700',
    cashier: 'bg-green-100 text-green-700', kitchen: 'bg-orange-100 text-orange-700',
  }[role] || 'bg-slate-100 text-slate-600');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-slate-500 mt-1">Admin: everything • Manager: reports & inventory • Cashier: billing • Kitchen: KDS only</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              : users.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">No users found.</TableCell></TableRow>
              : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                  <TableCell className="text-slate-500">{u.email || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${roleBadge(u.role)}`}>{u.role}</span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <select className="border border-slate-300 rounded p-1.5 text-xs" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.value}</option>)}
                    </select>
                    <Button variant="outline" size="sm" title="Reset password" onClick={() => setResetFor(u)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> New User</DialogTitle></DialogHeader>
          <form onSubmit={createUser} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={6} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="cashier">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Create User</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={v => { if (!v) setResetFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {resetFor?.display_name || resetFor?.email}</DialogTitle></DialogHeader>
          <form onSubmit={resetPassword} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newpw">New Password</Label>
              <Input id="newpw" name="password" type="password" minLength={6} required />
            </div>
            <Button type="submit" className="w-full">Update Password</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
