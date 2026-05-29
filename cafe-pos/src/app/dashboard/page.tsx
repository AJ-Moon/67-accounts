'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, ListOrdered, TrendingUp, Clock, Tag } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DashboardPage() {
  const [range, setRange] = useState('today');
  
  // Custom date handling for later if needed, hardcode filters first
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/summary?range=${range}`)
      .then(res => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      });
  }, [range]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 h-screen overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Hub</h1>
          <p className="text-slate-500 mt-1">Live metrics and historical summaries</p>
        </div>

        <div className="flex items-center gap-2 bg-white border rounded-md p-1 shadow-sm">
          <Select value={range} onValueChange={(val) => val && setRange(val)}>
             <SelectTrigger className="w-[180px] border-none shadow-none font-medium bg-transparent focus:ring-0">
               <SelectValue placeholder="Select period" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="today">Today</SelectItem>
               <SelectItem value="yesterday">Yesterday</SelectItem>
               <SelectItem value="week">This Week</SelectItem>
               <SelectItem value="month">This Month</SelectItem>
               <SelectItem value="previousMonth">Previous Month</SelectItem>
             </SelectContent>
          </Select>
        </div>
      </div>

      {loading || !data ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center">
           <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mb-4"></div>
           Loading dashboard analytics...
        </div>
      ) : (
        <>
          {/* Main KPI Row */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900 text-white shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium text-slate-300">Net Sales</CardTitle>
                 <Coins className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold">{formatCurrency(data.summary.netSales)}</div>
                 <div className="text-xs text-slate-400 mt-1">Gross: {formatCurrency(data.summary.totalSales)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium">Orders Processed</CardTitle>
                 <ListOrdered className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold text-slate-800">{data.summary.totalOrders}</div>
                 <div className="text-xs text-red-500 mt-1">{data.summary.cancelledCount} dropped</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                 <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold text-slate-800">{formatCurrency(data.summary.averageOrderValue)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm bg-red-50 border-red-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium text-red-700">Discounts Given</CardTitle>
                 <Tag className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold text-red-700">{formatCurrency(data.summary.discounts)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {/* Left Column: Breakdown Tables */}
             <div className="lg:col-span-1 space-y-6">
                <Card className="shadow-sm">
                   <CardHeader>
                     <CardTitle className="text-lg">Revenue by Category</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-slate-600 font-medium h-4">Drinks</span>
                       <span className="font-bold text-blue-600">{formatCurrency(data.summary.drinksRev)}</span>
                     </div>
                     <div className="flex justify-between items-center pb-1">
                       <span className="text-slate-600 font-medium h-4">Food & Add-ons</span>
                       <span className="font-bold text-orange-600">{formatCurrency(data.summary.foodRev)}</span>
                     </div>
                   </CardContent>
                </Card>

                <Card className="shadow-sm">
                   <CardHeader>
                     <CardTitle className="text-lg">Sales by Payment</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-slate-600 font-medium">Cash</span>
                       <span className="font-bold">{formatCurrency(data.summary.cashSales)}</span>
                     </div>
                     <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-slate-600 font-medium">Credit Card</span>
                       <span className="font-bold">{formatCurrency(data.summary.cardSales)}</span>
                     </div>
                     <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-slate-600 font-medium">Transfer</span>
                       <span className="font-bold">{formatCurrency(data.summary.transferSales)}</span>
                     </div>
                     <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-slate-600 font-medium">JazzCash</span>
                       <span className="font-bold">{formatCurrency(data.summary.jazzcashSales || 0)}</span>
                     </div>
                     <div className="flex justify-between items-center pb-1">
                       <span className="text-slate-600 font-medium">Foodpanda</span>
                       <span className="font-bold">{formatCurrency(data.summary.foodpandaSales || 0)}</span>
                     </div>
                   </CardContent>
                </Card>
             </div>

             {/* Right Column: Best Sellers */}
             <Card className="lg:col-span-2 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">Top Selling Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0 border-t">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!data.bestSellers || data.bestSellers.length === 0) ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-500">No items sold in this period.</TableCell></TableRow>
                      ) : (
                        data.bestSellers.map((item: any) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                               <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.category === 'Drinks' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                 {item.category}
                               </span>
                            </TableCell>
                            <TableCell className="text-right">{item.qty}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(item.rev)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
             </Card>
          </div>

          {/* Recent Orders List */}
          <div className="mt-8">
            <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-500"/> Recent Activity</h2>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Final Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data.recentOrders || data.recentOrders.length === 0) ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500 font-medium">No orders found for this period.</TableCell></TableRow>
                    ) : (
                      data.recentOrders.map((order: any) => (
                        <TableRow key={order.orderNumber} className={order.status === 'Cancelled' ? 'opacity-50' : ''}>
                          <TableCell className="font-semibold">{order.orderNumber}</TableCell>
                          <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{order.paymentMethod}</TableCell>
                          <TableCell>
                             <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${order.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                               {order.status}
                             </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(order.finalTotal)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
        </>
      )}
    </div>
  );
}
