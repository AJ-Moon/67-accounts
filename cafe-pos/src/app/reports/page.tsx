'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils';
import {
  Download, Calendar, Coins, CreditCard, Landmark, TrendingUp, XCircle,
  ShoppingBag, Pickaxe, Banknote, ArrowUpRight, ArrowDownRight, Activity, FileDown
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadReportPdf } from '@/lib/pdfReports';

const PDF_TYPES = [
  { value: 'sales_daily', label: 'Sales by Day' },
  { value: 'sales_monthly', label: 'Sales by Month' },
  { value: 'sales_orders', label: 'All Orders (detailed)' },
  { value: 'ledger', label: 'Ledger Entries' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'wastage', label: 'Wastage' },
] as const;

export default function ReportsPage() {
  const [range, setRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch current user role
  useEffect(() => {
    fetch('/api/auth/role').then(r => r.json()).then(d => setUserRole(d.role));
  }, []);

  // Desk role is locked to today only
  const isDesk = userRole === 'desk';
  const effectiveRange = isDesk ? 'today' : range;


  const fetchReport = () => {
    setLoading(true);
    let url = `/api/reports/accounting?range=${effectiveRange}`;
    if (!isDesk && effectiveRange === 'custom' && startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }
    
    fetch(url)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (userRole === null) return; // wait for role to load
    if (effectiveRange !== 'custom' || (startDate && endDate)) {
      fetchReport();
    }
  }, [effectiveRange, startDate, endDate, userRole]);

  const handleDownload = () => {
     window.print(); // Quick print integration for export MVP requirement
  };

  const [pdfType, setPdfType] = useState('sales_daily');
  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      // Use the selected custom dates when present; API defaults to current month
      await downloadReportPdf(pdfType as any, {
        from: range === 'custom' && startDate ? startDate : undefined,
        to: range === 'custom' && endDate ? endDate : undefined,
      });
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'PDF export failed');
    }
    setPdfBusy(false);
  };

  if (loading || !data) {
     return <div className="flex h-screen items-center justify-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Computing Ledgers...</div>;
  }

  const { currentBalances, dailyBalances, salesReport, expensesReport, earningsReport, summary, ledger } = data;

  const allTabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'sales', label: 'Sales' },
    { id: 'methods', label: 'Payment Methods' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'balances', label: 'Account Balances' },
    { id: 'ledger', label: 'Ledger Logs' },
  ];
  // Desk only sees today's sales summary tabs
  const tabs = isDesk
    ? allTabs.filter(t => ['summary', 'sales', 'methods'].includes(t.id))
    : allTabs;

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isDesk ? "Today's Sales Summary" : 'Financial Reports'}</h1>
          <p className="text-slate-500 mt-1">{isDesk ? "Cash, card & payment breakdown for today" : 'Immutable ledger accounting and analytics'}</p>
        </div>
        
        {!isDesk && (
          <div className="flex flex-col items-end gap-2">
             <div className="flex bg-slate-100 p-1 rounded-lg">
               {Object.entries({ today: 'Today', yesterday: 'Yesterday', week: 'This Week', month: 'This Month', lastMonth: 'Last Month', custom: 'Custom' }).map(([key, label]) => (
                 <button
                   key={key}
                   className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${range === key ? 'bg-white shadow text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                   onClick={() => setRange(key)}
                 >
                   {label}
                 </button>
               ))}
             </div>
             {range === 'custom' && (
               <div className="flex items-center gap-2 bg-slate-50 border p-1 rounded-md">
                 <input type="date" className="p-1 text-xs border rounded-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                 <span className="text-xs font-bold text-slate-400">to</span>
                 <input type="date" className="p-1 text-xs border rounded-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
               </div>
             )}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-6 shrink-0 no-scrollbar overflow-x-auto print:hidden">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-2 pb-2">
            {!isDesk && (
              <>
                <select className="border border-slate-300 bg-white text-xs font-bold p-1.5 rounded-md text-slate-700" value={pdfType} onChange={e => setPdfType(e.target.value)}>
                  {PDF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <Button size="sm" onClick={handlePdf} disabled={pdfBusy} className="font-bold text-xs bg-red-700 hover:bg-red-800 text-white">
                  <FileDown className="w-3 h-3 mr-2"/> {pdfBusy ? 'Building...' : 'Download PDF'}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={handleDownload} className="font-bold text-xs"><Download className="w-3 h-3 mr-2"/> Print/Export</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-12 print:overflow-visible">
        
        {activeTab === 'summary' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Card className="bg-slate-900 text-white shadow-xl">
                    <CardHeader className="pb-2"><CardTitle className="text-xs tracking-widest uppercase text-slate-400">Net Profit</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-black">{formatCurrency(summary.netAmount)}</div></CardContent>
                 </Card>
                 <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                    <CardHeader className="pb-2"><CardTitle className="text-xs tracking-widest uppercase text-blue-800">Gross Sales</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-900">{formatCurrency(summary.grossSales)}</div></CardContent>
                 </Card>
                 <Card className="shadow-sm border-red-100 bg-red-50/30">
                    <CardHeader className="pb-2"><CardTitle className="text-xs tracking-widest uppercase text-red-800">Total Expenses</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-900">{formatCurrency(summary.totalExpenses)}</div></CardContent>
                 </Card>
                 <Card className="shadow-sm border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2"><CardTitle className="text-xs tracking-widest uppercase text-emerald-800">Total Available Money (Global)</CardTitle></CardHeader>
                    <CardContent>
                       <div className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalAvailableLiquidMoney)}</div>
                       <div className="text-[10px] uppercase font-bold text-emerald-600 mt-1">Across all accounts & earnings globally</div>
                    </CardContent>
                 </Card>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Card>
                    <CardHeader className="pb-3 border-b"><CardTitle className="text-sm">Summary Operations</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-3">
                       <div className="flex justify-between items-center"><span className="text-slate-500 font-medium text-sm">Target Period Evaluated</span><span className="font-bold">{new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-500 font-medium text-sm">Total Orders Placed</span><span className="font-bold bg-slate-100 px-2 py-0.5 rounded text-xs">{salesReport.orderCount}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-500 font-medium text-sm">Moved to Earnings Vault</span><span className="font-bold text-purple-700">{formatCurrency(earningsReport.totalMovedIn)}</span></div>
                    </CardContent>
                 </Card>
                 <Card>
                    <CardHeader className="pb-3 border-b"><CardTitle className="text-sm">Revenue Splitting</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-3">
                       {Object.entries(salesReport.byMethod).map(([m, val]) => (
                          <div key={m} className="flex justify-between items-center text-sm">
                             <span className="font-semibold text-slate-600 capitalize">{m.replace('_', ' ')}</span>
                             <span className="font-bold">{formatCurrency(val as number)}</span>
                          </div>
                       ))}
                    </CardContent>
                 </Card>
             </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {['cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda'].map(m => (
                 <Card key={m} className="shadow-sm">
                   <CardHeader className="pb-1"><CardTitle className="text-[11px] tracking-widest uppercase font-bold text-slate-400">{m.replace('_', ' ')} Sales</CardTitle></CardHeader>
                   <CardContent className="text-xl font-bold">{formatCurrency((salesReport.byMethod[m] as number) || 0)}</CardContent>
                 </Card>
               ))}
             </div>
             <Card>
                <CardHeader className="border-b"><CardTitle className="text-sm">Sales by Category</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Revenue Generated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(salesReport.byCategory).map(cat => (
                         <TableRow key={cat}>
                           <TableCell className="font-medium text-slate-700">{cat}</TableCell>
                           <TableCell className="text-right font-bold">{formatCurrency(salesReport.byCategory[cat])}</TableCell>
                         </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
          </div>
        )}

        {activeTab === 'methods' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {['cash', 'credit_card', 'transfer', 'jazzcash', 'foodpanda'].map(m => {
                const salesGen = (salesReport.byMethod[m] as number) || 0;
                const expensesPaid = (expensesReport.byAccount[m] as number) || 0;
                const earningsMoved = (earningsReport.breakdownSource[m] as number) || 0;
                 const liveBalance = currentBalances[m].current;
                 const dailyBalance = dailyBalances ? dailyBalances[m].current : 0;
                 
                 return (
                  <Card key={m} className="border-t-4 border-t-slate-800">
                     <CardHeader className="pb-2 border-b">
                       <CardTitle className="text-lg uppercase tracking-wider">{m.replace('_', ' ')} Register</CardTitle>
                     </CardHeader>
                     <CardContent className="pt-4 space-y-4">
                        <div className="flex justify-between p-2 rounded bg-green-50">
                           <span className="text-sm font-semibold text-green-800">Total Sales Collected</span>
                           <span className="font-bold text-green-900">{formatCurrency(salesGen)}</span>
                        </div>
                        <div className="flex justify-between px-2 text-sm text-slate-600">
                           <span>Moved to Earnings</span>
                           <span className="font-bold">-{formatCurrency(earningsMoved)}</span>
                        </div>
                        <div className="flex justify-between px-2 text-sm text-slate-600">
                           <span>Expenses Paid Directly</span>
                           <span className="font-bold">-{formatCurrency(expensesPaid)}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-blue-50 border border-blue-200 mt-2">
                           <span className="text-sm font-black uppercase tracking-wider text-blue-900">Today's Net Balance</span>
                           <span className="font-black text-blue-900">{formatCurrency(dailyBalance)}</span>
                        </div>
                        {!isDesk && (
                        <div className="flex justify-between p-2 rounded bg-slate-100 border mt-2">
                           <span className="text-sm font-black uppercase tracking-wider text-slate-800">Live Global Balance</span>
                           <span className="font-black text-slate-900">{formatCurrency(liveBalance)}</span>
                        </div>
                        )}
                     </CardContent>
                  </Card>
                 )
             })}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 bg-purple-50 border-purple-200">
                   <CardContent className="pt-6">
                     <p className="text-xs uppercase font-bold tracking-widest text-purple-600 mb-1">Total Moved into Earnings</p>
                     <h2 className="text-4xl font-black text-purple-900">{formatCurrency(earningsReport.totalMovedIn)}</h2>
                     <div className="mt-6 space-y-2 border-t border-purple-200 pt-4">
                        <div className="flex justify-between text-sm"><span className="text-purple-700">Expenses Deducted:</span><span className="font-bold text-purple-900">-{formatCurrency(earningsReport.expensesPaidFromEarnings)}</span></div>
                        <div className="flex justify-between text-sm mt-3 pt-3 border-t border-purple-300"><span className="font-bold text-purple-800 uppercase tracking-widest">Global Vault Current Balance:</span><span className="font-black text-purple-900 text-lg">{formatCurrency(currentBalances.earnings.current)}</span></div>
                     </div>
                   </CardContent>
                </Card>
                <Card className="md:col-span-2">
                   <CardHeader className="border-b"><CardTitle className="text-sm">Earnings Sources (Scope)</CardTitle></CardHeader>
                   <CardContent className="pt-4 grid grid-cols-2 gap-4">
                      {Object.entries(earningsReport.breakdownSource).map(([src, val]) => (
                         <div key={src} className="flex flex-col p-3 border rounded-lg bg-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase">{src.replace('_', ' ')}</span>
                            <span className="text-xl font-bold mt-1 text-slate-800">{formatCurrency(val as number)}</span>
                         </div>
                      ))}
                   </CardContent>
                </Card>
             </div>
             
             <Card>
                <CardHeader className="border-b"><CardTitle className="text-sm">Earnings Ledger Log</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>From Account</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earningsReport.history.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs whitespace-nowrap text-slate-500">{new Date(t.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-bold capitalize">{t.sourceAccount?.replace('_', ' ')}</TableCell>
                          <TableCell className="text-sm text-slate-600">{t.note}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">+{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
          </div>
        )}

        {activeTab === 'expenses' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader className="border-b"><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-2">
                       {Object.entries(expensesReport.byCategory).map(([cat, val]) => (
                          <div key={cat} className="flex justify-between text-sm py-1 border-b last:border-0 border-slate-100">
                             <span className="font-medium text-slate-700">{cat}</span>
                             <span className="font-bold">{formatCurrency(val as number)}</span>
                          </div>
                       ))}
                       {Object.keys(expensesReport.byCategory).length === 0 && <span className="text-slate-400 text-sm">No expenses logged.</span>}
                    </CardContent>
                 </Card>
                 <Card>
                    <CardHeader className="border-b"><CardTitle className="text-sm">Expenses Paid-From Matrix</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-2">
                       {Object.entries(expensesReport.byAccount).map(([acc, val]) => (
                          <div key={acc} className="flex justify-between text-sm py-1 border-b last:border-0 border-slate-100">
                             <span className="font-medium text-slate-700 capitalize">Paid from {acc.replace('_', ' ')}</span>
                             <span className="font-bold">{formatCurrency(val as number)}</span>
                          </div>
                       ))}
                       {Object.keys(expensesReport.byAccount).length === 0 && <span className="text-slate-400 text-sm">No expenses logged.</span>}
                    </CardContent>
                 </Card>
              </div>

              <Card>
                <CardHeader className="border-b"><CardTitle className="text-sm">Detailed Expense Logs</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Account Deducted</TableHead>
                        <TableHead className="text-right">Amount Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesReport.list.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs whitespace-nowrap text-slate-500">{new Date(e.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-slate-800 text-xs uppercase">{e.category}</TableCell>
                          <TableCell className="text-sm text-slate-700">{e.title}</TableCell>
                          <TableCell className="text-xs uppercase font-bold tracking-widest text-slate-400">{e.paidFromAccount?.replace('_', ' ')}</TableCell>
                          <TableCell className="text-right font-black text-red-600">-{formatCurrency(e.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {expensesReport.list.length === 0 && <TableRow><TableCell colSpan={5} className="py-4 text-center text-slate-400 text-sm">No recorded expenses matching criteria</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
           </div>
        )}

        {activeTab === 'balances' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(currentBalances).map(([acct, metrics]: [string, any]) => (
                 <Card key={acct} className={`${acct === 'earnings' ? 'bg-purple-900 text-white border-purple-800' : 'bg-white'}`}>
                    <CardHeader className="pb-2 border-b border-opacity-10">
                       <CardTitle className={`text-sm tracking-widest uppercase font-bold ${acct === 'earnings' ? 'text-purple-300' : 'text-slate-500'}`}>{acct.replace('_', ' ')} Account</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                       <div className="flex justify-between text-sm">
                          <span className={acct === 'earnings' ? 'text-purple-200' : 'text-slate-500'}>Total Inwards (All-Time)</span>
                          <span className="font-bold">+{formatCurrency(metrics.incoming)}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                          <span className={acct === 'earnings' ? 'text-purple-200' : 'text-slate-500'}>Total Outwards (All-Time)</span>
                          <span className="font-bold">-{formatCurrency(metrics.outgoing)}</span>
                       </div>
                       <div className={`mt-2 pt-3 border-t flex justify-between items-center ${acct === 'earnings' ? 'border-purple-700' : 'border-slate-100'}`}>
                          <span className="text-xs uppercase tracking-widest font-black">Live Balance</span>
                          <span className={`text-xl font-black ${acct === 'earnings' ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(metrics.current)}</span>
                       </div>
                    </CardContent>
                 </Card>
              ))}
           </div>
        )}

        {activeTab === 'ledger' && (
           <Card>
              <CardHeader className="border-b bg-slate-900 text-white">
                 <CardTitle className="text-sm uppercase tracking-widest flex justify-between items-center">
                    <span>Source Of Truth Ledger</span>
                    <span className="text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{ledger.length} Scoped Logs</span>
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>System Timestamp</TableHead>
                      <TableHead>Flux Type</TableHead>
                      <TableHead>Origin Node</TableHead>
                      <TableHead>Target Node</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Magnitude</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap text-slate-500">{new Date(t.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                           <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${t.transactionType === 'sale' ? 'bg-blue-100 text-blue-700' : t.transactionType === 'expense' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                              {t.transactionType.replace('_', ' ')}
                           </span>
                        </TableCell>
                        <TableCell className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.sourceAccount?.replace('_', ' ') || t.paymentMethod?.replace('_', ' ') || 'SYSTEM'}</TableCell>
                        <TableCell className="text-xs font-bold uppercase tracking-wider text-slate-800">{t.destinationAccount?.replace('_', ' ') || 'NONE'}</TableCell>
                        <TableCell className="text-sm text-slate-600 truncate max-w-[200px]">{t.transactionType === 'sale' ? `POS Sale Checkout` : t.note}</TableCell>
                        <TableCell className="text-right font-black whitespace-nowrap text-sm">
                           {t.transactionType === 'expense' || t.transactionType === 'earnings_transfer' ? (
                             <span className={`${t.transactionType === 'expense' ? 'text-red-600' : 'text-purple-600'}`}>
                                <ArrowDownRight className="w-3 h-3 inline mr-1 -mt-0.5"/>
                                {formatCurrency(t.amount)}
                             </span>
                           ) : (
                             <span className="text-green-600">
                                <ArrowUpRight className="w-3 h-3 inline mr-1 -mt-0.5"/>
                                {formatCurrency(t.amount)}
                             </span>
                           )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledger.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-400 font-medium tracking-wide text-sm">NO SYSTEM FLUX IN SELECTED TIMEFRAME</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
           </Card>
        )}

      </div>
    </div>
  );
}
