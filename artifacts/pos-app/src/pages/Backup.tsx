import { useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatabaseBackup, Download, Upload, AlertTriangle, HardDrive, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Backup() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleExport = () => {
    // Triggers standard browser download
    window.location.href = '/api/backup/export';
    toast({ title: "Backup download started", description: "Your file should download shortly." });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!window.confirm("CRITICAL WARNING: Restoring a backup will ERASE all current data and replace it with the backup. Are you absolutely sure?")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        
        if (res.ok) {
          toast({ title: "Restore successful", description: "The system will now reload." });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast({ title: "Restore failed", description: "Server rejected the backup file.", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Invalid File", description: "The selected file is not a valid JSON backup.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Backup & Restore" 
        description="Secure your data and restore from previous states"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* EXPORT */}
        <Card className="shadow-lg border-none ring-1 ring-border overflow-hidden group">
          <div className="h-2 bg-accent w-full"></div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 text-accent">
              <Download className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-display">Export Data</CardTitle>
            <CardDescription className="text-base mt-2">
              Download a complete JSON snapshot of your database. This includes all products, sales, customers, and history.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="p-4 bg-muted/40 rounded-xl mb-6 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Safe operation.</span> Creating a backup does not affect your live system. Do this regularly to prevent data loss.
              </div>
            </div>
            <Button onClick={handleExport} className="w-full h-14 text-lg rounded-xl shadow-lg shadow-primary/20">
              <HardDrive className="w-5 h-5 mr-2" /> Download Backup
            </Button>
          </CardContent>
        </Card>

        {/* IMPORT */}
        <Card className="shadow-lg border-none ring-1 ring-red-200 bg-red-50/30 overflow-hidden">
          <div className="h-2 bg-red-500 w-full"></div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4 text-red-600">
              <Upload className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-display text-red-950">Restore Data</CardTitle>
            <CardDescription className="text-base mt-2 text-red-900/70">
              Upload a previously downloaded JSON backup file to restore the system to that exact state.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="p-4 bg-red-100 border border-red-200 rounded-xl mb-6 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
              <div className="text-sm text-red-800">
                <span className="font-bold block mb-1">DANGER ZONE</span> 
                Restoring a backup will <strong>permanently erase</strong> all current data. Make sure you export a fresh backup before proceeding.
              </div>
            </div>
            
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <Button 
              variant="destructive" 
              onClick={handleImportClick} 
              className="w-full h-14 text-lg rounded-xl shadow-lg shadow-red-500/20 bg-red-600 hover:bg-red-700"
            >
              <DatabaseBackup className="w-5 h-5 mr-2" /> Upload & Restore
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
