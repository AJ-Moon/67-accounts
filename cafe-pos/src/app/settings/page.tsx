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
  const [settings, setSettings] = useState({
    shopName: '',
    address: '',
    phone: '',
    footerMessage: '',
    printerType: 'USB',
    printerAddress: ''
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings(data);
        setLoading(false);
      });
  }, []);

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

        <div className="flex justify-end gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
