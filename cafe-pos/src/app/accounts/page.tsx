'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from '@/lib/utils';
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, ReceiptText, Banknote } from 'lucide-react';

type LedgerTransaction = {
  id: string;
  transactionType: string;
  sourceAccount: string | null;
  destinationAccount: string | null;
  amount: number;
  note: string | null;
  createdAt: string;
};

export default function AccountsPage() {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Transfer State
  const [transferOpen, setTransferOpen] = useState(false);
  const [sourceAccount, setSourceAccount] = useState('cash');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Expense State
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('cash');
  const [expensing, setExpensing] = useState(false);

  const fetchLedger = () => {
    fetch('/api/ledger')
      .then(res => res.json())
      .then(data => {
        if (data.balances) setBalances(data.balances);
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleTransfer = async () => {
    if (!transferAmount || Number(transferAmount) <= 0) return toast.error("Enter valid amount");
    setTransferring(true);
    const res = await fetch('/api/ledger/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceAccount, amount: Number(transferAmount), note: transferNote }),
    });
    setTransferring(false);
    if (res.ok) {
      toast.success("Funds transferred to Earnings");
      setTransferOpen(false);
      fetchLedger();
    } else toast.error("Transfer failed");
  };

  const handleExpense = async () => {
    if (!expenseTitle || !expenseCategory || Number(expenseAmount) <= 0) return toast.error("Fill required fields");
    setExpensing(true);
    const res = await fetch('/api/ledger/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: expenseTitle, category: expenseCategory, paidFromAccount: expenseAccount, amount: Number(expenseAmount) }),
    });
    setExpensing(false);
    if (res.ok) {
      toast.success("Expense recorded successfully");
      setExpenseOpen(false);
      fetchLedger();
    } else toast.error("Expense failed");
  };

  const accountCards = [
    { key: 'cash', label: 'Cash' },
    { key: 'credit_card', label: 'Credit Card' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'jazzcash', label: 'JazzCash' },
    { key: 'foodpanda', label: 'Foodpanda' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-screen overflow-hidden">
      <div className="mb-6 shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts & Ledger</h1>
          <p className="text-slate-500 mt-1">Manage finances, move to earnings, and record expenses</p>
        </div>
        <div className="flex gap-2">
          {/* Transfer Transfer Modal */}
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger>
              <span className="inline-flex h-10 px-4 items-center justify-center rounded-md text-sm font-bold bg-slate-900 border text-white transition-colors cursor-pointer"><Banknote className="w-4 h-4 mr-2"/> Move to Earnings</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Funds to Earnings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Source Account</Label>
                  <Select value={sourceAccount} onValueChange={(val) => setSourceAccount(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Account" /></SelectTrigger>
                    <SelectContent>
                      {accountCards.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Note (Optional)</Label>
                  <Input value={transferNote} onChange={e => setTransferNote(e.target.value)} />
                </div>
                <Button onClick={handleTransfer} disabled={transferring} className="w-full font-bold">Transfer to Earnings</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Expense Modal */}
          <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
            <DialogTrigger>
              <span className="inline-flex h-10 px-4 items-center justify-center rounded-md text-sm font-bold border border-slate-300 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"><ReceiptText className="w-4 h-4 mr-2"/> Record Expense</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record an Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Title / Description</Label>
                  <Input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="e.g. Weekly Cleaning" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={expenseCategory} onValueChange={(val) => setExpenseCategory(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Salaries">Salaries</SelectItem>
                      <SelectItem value="Cleaning">Cleaning</SelectItem>
                      <SelectItem value="Stock">Stock / Items</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Paid From Account</Label>
                  <Select value={expenseAccount} onValueChange={(val) => setExpenseAccount(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Account" /></SelectTrigger>
                    <SelectContent>
                      {[...accountCards, {key: 'earnings', label: 'Earnings'}].map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                </div>
                <Button onClick={handleExpense} disabled={expensing} className="w-full bg-red-600 hover:bg-red-700 font-bold text-white">Record Expense</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 shrink-0">
        <Card className="col-span-2 md:col-span-full border-green-200 bg-green-50/50">
           <CardContent className="p-4 flex justify-between items-center">
             <div>
               <p className="text-sm font-semibold text-green-800 uppercase">Available Earnings</p>
               <h3 className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(balances['earnings'] || 0)}</h3>
             </div>
             <Banknote className="w-10 h-10 text-green-600/30" />
           </CardContent>
        </Card>
        {accountCards.map(acc => (
          <Card key={acc.key} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{acc.label}</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(balances[acc.key] || 0)}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-sm">
        <CardHeader className="bg-slate-50 border-b px-4 py-3 shrink-0">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Global Ledger History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-500">Loading ledger...</TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-500">No ledger transactions found.</TableCell></TableRow>
              ) : (
                history.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-slate-500 text-[13px]">{new Date(t.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {t.transactionType === 'sale' && <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Sale</span>}
                      {t.transactionType === 'expense' && <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Expense</span>}
                      {t.transactionType === 'earnings_transfer' && <span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Commit to Earnings</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 font-medium max-w-xs truncate">
                       {t.transactionType === 'sale' ? `Order payment (${t.sourceAccount ?? 'auto'})` : t.note}
                    </TableCell>
                    <TableCell className="text-right">
                       <span className={`inline-flex items-center gap-1 font-bold ${t.transactionType === 'expense' ? 'text-red-600' : 'text-slate-900'}`}>
                         {t.transactionType === 'expense' ? <ArrowDownRight className="w-3 h-3"/> : <ArrowUpRight className="w-3 h-3 text-green-600"/>}
                         {formatCurrency(t.amount)}
                       </span>
                       <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mt-0.5">
                          {t.sourceAccount && t.destinationAccount ? `${t.sourceAccount} → ${t.destinationAccount}` : 
                           t.sourceAccount ? `From ${t.sourceAccount}` : `To ${t.destinationAccount}`}
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
