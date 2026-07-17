'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({
    shopName: '',
    address: '',
    phone: '',
    footerMessage: '',
    printerType: 'USB',
    printerAddress: '',
    taxEnabled: false,
    taxInclusive: false,
  });
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');

  const loadKeys = () => fetch('/api/keys').then(r => r.json()).then(d => { if (Array.isArray(d)) setApiKeys(d); });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings((s: any) => ({ ...s, ...data }));
        setLoading(false);
      });
    fetch('/api/tax-rates').then(r => r.json()).then(d => { if (Array.isArray(d)) setTaxRates(d); });
    loadKeys();
  }, []);

  const saveTaxRates = async () => {
    const res = await fetch('/api/tax-rates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rates: taxRates }),
    });
    if (res.ok) toast.success('Tax rates saved'); else toast.error('Failed to save tax rates');
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return toast.error('Give the key a name (e.g. Website)');
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const j = await res.json();
    if (res.ok) { toast.success('API key created'); setNewKeyName(''); loadKeys(); }
    else toast.error(j.error || 'Failed to create key');
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key? Apps using it will stop working.')) return;
    const res = await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success('Key revoked'); loadKeys(); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved successfully!");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (e) {
      toast.error("Network error");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shop Details</CardTitle>
            <CardDescription>This information will appear on the receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Shop Name</Label>
              <Input 
                id="name" 
                value={settings.shopName} 
                onChange={(e) => setSettings({...settings, shopName: e.target.value})} 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                value={settings.address} 
                onChange={(e) => setSettings({...settings, address: e.target.value})} 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                value={settings.phone} 
                onChange={(e) => setSettings({...settings, phone: e.target.value})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Printer Configuration</CardTitle>
            <CardDescription>Setup thermal receipt printer integration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Connection Type</Label>
              <Select 
                value={settings.printerType} 
                onValueChange={(v) => setSettings({...settings, printerType: v as string})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USB">USB connection</SelectItem>
                  <SelectItem value="Network">Local Network (Ethernet/WiFi)</SelectItem>
                  <SelectItem value="Bluetooth">Bluetooth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1 mt-4">
              <Label htmlFor="ip">
                {settings.printerType === 'Network' ? 'Printer IP Address' : 'Printer System Name (CUPS)'}
              </Label>
              <Input 
                id="ip" 
                placeholder={settings.printerType === 'Network' ? 'e.g. 192.168.1.100' : 'e.g. Printer_POS_80'}
                value={settings.printerAddress} 
                onChange={(e) => setSettings({...settings, printerAddress: e.target.value})} 
              />
              {settings.printerType === 'USB' && (
                <p className="text-xs text-slate-500 mt-1">Provide the exact internal printer name added to your Mac. (e.g., Printer_POS_80)</p>
              )}
            </div>
            <div className="space-y-1 mt-4">
              <Label htmlFor="footer">Receipt Footer Message</Label>
              <Input 
                id="footer" 
                value={settings.footerMessage} 
                onChange={(e) => setSettings({...settings, footerMessage: e.target.value})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & Billing</CardTitle>
            <CardDescription>Tax rate depends on the payment method (e.g. 16% cash / 5% card).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tax on bills</Label>
                <Select value={String(settings.taxEnabled)} onValueChange={v => setSettings({ ...settings, taxEnabled: v === 'true' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Price mode</Label>
                <Select value={String(settings.taxInclusive)} onValueChange={v => setSettings({ ...settings, taxInclusive: v === 'true' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Tax added on top of prices</SelectItem>
                    <SelectItem value="true">Prices already include tax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {settings.taxEnabled && (
              <div className="space-y-2 pt-2">
                <Label className="text-slate-600">Rates per payment method (%)</Label>
                {taxRates.map((r, idx) => (
                  <div key={r.paymentMethod} className="flex items-center gap-3">
                    <span className="w-32 text-sm font-medium capitalize">{r.paymentMethod.replace('_', ' ')}</span>
                    <Input type="number" step="0.5" min="0" max="100" className="w-28"
                      value={r.rate}
                      onChange={e => setTaxRates(rs => rs.map((x, i) => i === idx ? { ...x, rate: e.target.value } : x))} />
                  </div>
                ))}
                <Button variant="outline" onClick={saveTaxRates} className="mt-2">Save Tax Rates</Button>
                <p className="text-xs text-slate-500">Note: tax is finalized using the payment method chosen when the order is completed.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Connect your website or apps. Send the key in the <code>x-api-key</code> header. See API.md for endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Key name, e.g. Website" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
              <Button onClick={createKey}>Generate Key</Button>
            </div>
            {apiKeys.length > 0 && (
              <div className="space-y-2">
                {apiKeys.map(k => (
                  <div key={k.id} className={`flex items-center justify-between gap-2 rounded border p-2 ${!k.isActive ? 'opacity-50' : ''}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{k.name} {!k.isActive && <span className="text-xs text-red-500">(revoked)</span>}</div>
                      <div className="text-xs font-mono text-slate-500 truncate">{k.key}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(k.key); toast.success('Copied'); }}>Copy</Button>
                      {k.isActive && <Button variant="destructive" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
