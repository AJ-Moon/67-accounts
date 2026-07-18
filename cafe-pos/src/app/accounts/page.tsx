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
import { ArrowDownRight, ArrowUpRight, ReceiptText, Banknote, PiggyBank, Plus, FileDown, X } from 'lucide-react';
import { downloadReportPdf } from '@/lib/pdfReports';

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
  const [destinationAccount, setDestinationAccount] = useState('earnings');
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

  // Capital State
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [capitalDirection, setCapitalDirection] = useState('in');
  const [capitalAccount, setCapitalAccount] = useState('cash');
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalNote, setCapitalNote] = useState('');
  const [capitalSaving, setCapitalSaving] = useState(false);

  // Dynamic accounts + new account dialog
  const [dynamicAccounts, setDynamicAccounts] = useState<any[]>([]);
  const [newAccountOpen, setNewAccountOpen] = useState(false);

  // Individual ledger filters
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const fetchLedger = () => {
    fetch('/api/ledger')
      .then(res => res.json())
      .then(data => {
        if (data.balances) setBalances(data.balances);
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setDynamicAccounts(data.filter((a: any) => a.isActive)); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleCapital = async () => {
    if (!capitalAmount || Number(capitalAmount) <= 0) return toast.error("Enter valid amount");
    setCapitalSaving(true);
    const res = await fetch('/api/ledger/capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: capitalDirection, account: capitalAccount, amount: Number(capitalAmount), note: capitalNote }),
    });
    setCapitalSaving(false);
    if (res.ok) {
      toast.success(capitalDirection === 'in' ? "Capital added" : "Capital withdrawn");
      setCapitalOpen(false); setCapitalAmount(''); setCapitalNote('');
      fetchLedger();
    } else toast.error("Capital transaction failed");
  };

  // Every ledger you can pick from the dropdown (all accounts incl. earnings & capital)
  const ledgerOptions: { key: string; label: string }[] = dynamicAccounts.length > 0
    ? dynamicAccounts.map(a => ({ key: a.code, label: a.name }))
    : [
        { key: 'cash', label: 'Cash' }, { key: 'credit_card', label: 'Credit Card' },
        { key: 'transfer', label: 'Bank Transfer' }, { key: 'jazzcash', label: 'JazzCash' },
        { key: 'foodpanda', label: 'Foodpanda' }, { key: 'cash_holding', label: 'Cash Holding' },
        { key: 'earnings', label: 'Earnings' }, { key: 'capital', label: 'Owner Capital' },
      ];

  // Individual ledger: filter history by selected account, type, and search
  const filteredHistory = history.filter(t => {
    if (selectedAccount && t.sourceAccount !== selectedAccount && t.destinationAccount !== selectedAccount) return false;
    if (typeFilter === 'Expenses' && !['expense', 'inventory_purchase'].includes(t.transactionType)) return false;
    if (typeFilter === 'Sales' && t.transactionType !== 'sale') return false;
    if (typeFilter === 'Capital' && !['capital_injection', 'capital_withdrawal'].includes(t.transactionType)) return false;
    if (typeFilter === 'Transfers' && !['interaccount_transfer', 'earnings_transfer'].includes(t.transactionType)) return false;
    if (typeFilter === 'Adjustments' && t.transactionType !== 'manual_adjustment') return false;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const hay = `${t.note || ''} ${t.transactionType} ${t.sourceAccount || ''} ${t.destinationAccount || ''} ${t.amount}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fromDate && new Date(t.createdAt) < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && new Date(t.createdAt) > new Date(`${toDate}T23:59:59.999`)) return false;
    return true;
  });

  const accountIn = selectedAccount
    ? filteredHistory.filter(t => t.destinationAccount === selectedAccount).reduce((s, t) => s + Number(t.amount), 0) : 0;
  const accountOut = selectedAccount
    ? filteredHistory.filter(t => t.sourceAccount === selectedAccount).reduce((s, t) => s + Number(t.amount), 0) : 0;

  const handleAccountPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadReportPdf('ledger', {
        account: selectedAccount || undefined,
        from: fromDate || '2000-01-01', // no date chosen = full history, same as on screen
        to: toDate || undefined,
      });
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'PDF export failed');
    }
    setPdfBusy(false);
  };

  const handleNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: fd.get('code'), name: fd.get('name'), type: fd.get('type'),
        isPaymentMethod: fd.get('isPaymentMethod') === 'true',
        openingBalance: parseFloat(String(fd.get('openingBalance')) || '0'),
      }),
    });
    const j = await res.json();
    if (res.ok) { toast.success("Account created"); setNewAccountOpen(false); fetchLedger(); }
    else toast.error(j.error || "Failed to create account");
  };

  const handleTransfer = async () => {
    if (!transferAmount || Number(transferAmount) <= 0) return toast.error("Enter valid amount");
    setTransferring(true);
    const res = await fetch('/api/ledger/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceAccount, destinationAccount, amount: Number(transferAmount), note: transferNote }),
    });
    setTransferring(false);
    if (res.ok) {
      toast.success("Funds transferred successfully");
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

  // Dynamic list from the accounts table; falls back to defaults before first load
  const accountCards = dynamicAccounts.length > 0
    ? dynamicAccounts
        .filter(a => a.code !== 'earnings' && a.code !== 'capital')
        .map(a => ({ key: a.code, label: a.name, balance: Number(a.balance || 0) }))
    : [
        { key: 'cash', label: 'Cash' },
        { key: 'credit_card', label: 'Credit Card' },
        { key: 'transfer', label: 'Transfer' },
        { key: 'jazzcash', label: 'JazzCash' },
        { key: 'foodpanda', label: 'Foodpanda' },
        { key: 'cash_holding', label: 'Cash Holding' }
      ] as any[];

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-screen overflow-hidden">
      <div className="mb-6 shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts & Ledger</h1>
          <p className="text-slate-500 mt-1">Manage finances, move to earnings, and record expenses</p>
        </div>
        <div className="flex gap-2">
          {/* Capital Modal */}
          <Dialog open={capitalOpen} onOpenChange={setCapitalOpen}>
            <DialogTrigger>
              <span className="inline-flex h-10 px-4 items-center justify-center rounded-md text-sm font-bold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"><PiggyBank className="w-4 h-4 mr-2"/> Capital</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Owner Capital</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={capitalDirection} onValueChange={(v) => setCapitalDirection(v || 'in')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Add capital into business</SelectItem>
                      <SelectItem value="out">Withdraw capital to owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{capitalDirection === 'in' ? 'Deposit Into Account' : 'Withdraw From Account'}</Label>
                  <Select value={capitalAccount} onValueChange={(v) => setCapitalAccount(v || 'cash')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accountCards.map((a: any) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={capitalAmount} onChange={e => setCapitalAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Note (Optional)</Label>
                  <Input value={capitalNote} onChange={e => setCapitalNote(e.target.value)} placeholder="e.g. Initial investment" />
                </div>
                <Button onClick={handleCapital} disabled={capitalSaving} className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                  {capitalDirection === 'in' ? 'Add Capital' : 'Withdraw Capital'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* New Account Modal */}
          <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
            <DialogTrigger>
              <span className="inline-flex h-10 px-4 items-center justify-center rounded-md text-sm font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"><Plus className="w-4 h-4 mr-2"/> Account</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleNewAccount} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input name="name" placeholder="e.g. EasyPaisa" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Code (no spaces)</Label>
                    <Input name="code" placeholder="e.g. easypaisa" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue="wallet">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                        <SelectItem value="platform">Platform</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Usable at Billing?</Label>
                    <Select name="isPaymentMethod" defaultValue="true">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes — payment method</SelectItem>
                        <SelectItem value="false">No — internal only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Opening Balance</Label>
                  <Input name="openingBalance" type="number" step="0.01" defaultValue={0} />
                </div>
                <Button type="submit" className="w-full font-bold">Create Account</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Transfer Funds Modal */}
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger>
              <span className="inline-flex h-10 px-4 items-center justify-center rounded-md text-sm font-bold bg-slate-900 border text-white transition-colors cursor-pointer"><Banknote className="w-4 h-4 mr-2"/> Move Funds</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Funds</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Source Account</Label>
                  <Select value={sourceAccount} onValueChange={(val) => setSourceAccount(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                    <SelectContent>
                      {accountCards.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination Account</Label>
                  <Select value={destinationAccount} onValueChange={(val) => setDestinationAccount(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earnings">Earnings</SelectItem>
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
                <Button onClick={handleTransfer} disabled={transferring} className="w-full font-bold">Transfer Funds</Button>
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
        <Card
          onClick={() => setSelectedAccount(selectedAccount === 'earnings' ? null : 'earnings')}
          className={`col-span-2 md:col-span-full border-green-200 bg-green-50/50 cursor-pointer transition-all hover:shadow-md ${selectedAccount === 'earnings' ? 'ring-2 ring-green-600' : ''}`}
        >
           <CardContent className="p-4 flex justify-between items-center">
             <div>
               <p className="text-sm font-semibold text-green-800 uppercase">Available Earnings {selectedAccount === 'earnings' && <span className="text-[10px] bg-green-200 px-2 py-0.5 rounded ml-2">SHOWING LEDGER ↓</span>}</p>
               <h3 className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(balances['earnings'] || 0)}</h3>
             </div>
             <Banknote className="w-10 h-10 text-green-600/30" />
           </CardContent>
        </Card>
        {accountCards.map((acc: any) => (
          <Card
            key={acc.key}
            onClick={() => setSelectedAccount(selectedAccount === acc.key ? null : acc.key)}
            className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${selectedAccount === acc.key ? 'ring-2 ring-amber-500 bg-amber-50/50' : ''}`}
          >
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{acc.label}</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(acc.balance ?? balances[acc.key] ?? 0)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{selectedAccount === acc.key ? 'Showing ledger ↓' : 'Click for ledger'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-sm">
        <CardHeader className="bg-slate-50 border-b px-4 py-3 shrink-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">
                {selectedAccount
                  ? <>Ledger: <span className="text-amber-600">{(ledgerOptions.find(a => a.key === selectedAccount)?.label || selectedAccount).toUpperCase()}</span></>
                  : typeFilter !== 'All' ? <>{typeFilter} Ledger — All Accounts</> : 'Global Ledger History'}
              </CardTitle>
              {selectedAccount && (
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-green-700">In: {formatCurrency(accountIn)}</span>
                  <span className="text-red-600">Out: {formatCurrency(accountOut)}</span>
                  <span className="text-slate-900">Net: {formatCurrency(accountIn - accountOut)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border border-slate-300 bg-white text-xs font-bold p-1.5 rounded-md text-slate-700"
                value={selectedAccount || 'all'}
                onChange={e => setSelectedAccount(e.target.value === 'all' ? null : e.target.value)}
              >
                <option value="all">All Accounts</option>
                {ledgerOptions.map(a => <option key={a.key} value={a.key}>{a.label} Ledger</option>)}
              </select>
              <select
                className="border border-slate-300 bg-white text-xs font-bold p-1.5 rounded-md text-slate-700"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                {['All', 'Sales', 'Expenses', 'Transfers', 'Capital', 'Adjustments'].map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
              </select>
              <input
                className="border border-slate-300 bg-white text-xs p-1.5 rounded-md text-slate-700 flex-1 min-w-[140px] max-w-xs outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Search notes, amounts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <div className="flex items-center gap-1 border border-slate-300 bg-white rounded-md px-1.5 py-0.5">
                <input type="date" className="text-xs text-slate-700 outline-none py-1" title="From date"
                  value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-[10px] font-bold text-slate-400">to</span>
                <input type="date" className="text-xs text-slate-700 outline-none py-1" title="To date"
                  value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              {(selectedAccount || typeFilter !== 'All' || searchTerm || fromDate || toDate) && (
                <button
                  onClick={() => { setSelectedAccount(null); setTypeFilter('All'); setSearchTerm(''); setFromDate(''); setToDate(''); }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1.5 rounded transition-colors"
                >
                  <X className="w-3 h-3" /> CLEAR
                </button>
              )}
              <span className="text-[11px] text-slate-400 font-medium">{filteredHistory.length} entries</span>
              <Button size="sm" onClick={handleAccountPdf} disabled={pdfBusy} className="h-8 text-xs font-bold bg-red-700 hover:bg-red-800 text-white ml-auto">
                <FileDown className="w-3 h-3 mr-1" /> {pdfBusy ? '...' : 'PDF'}
              </Button>
            </div>
          </div>
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
              ) : filteredHistory.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-500">No ledger transactions found{selectedAccount ? ' for this account' : ''}.</TableCell></TableRow>
              ) : (
                filteredHistory.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-slate-500 text-[13px]">{new Date(t.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {t.transactionType === 'sale' && <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Sale</span>}
                      {t.transactionType === 'expense' && <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Expense</span>}
                      {t.transactionType === 'earnings_transfer' && <span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Commit to Earnings</span>}
                      {t.transactionType === 'interaccount_transfer' && <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Transfer</span>}
                      {t.transactionType === 'capital_injection' && <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Capital In</span>}
                      {t.transactionType === 'capital_withdrawal' && <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Capital Out</span>}
                      {t.transactionType === 'inventory_purchase' && <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Stock Buy</span>}
                      {t.transactionType === 'manual_adjustment' && <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Adjustment</span>}
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
