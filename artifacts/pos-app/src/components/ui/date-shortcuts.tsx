import { Button } from "@/components/ui/button";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";

interface DateShortcutsProps {
  onSelect: (from: string, to: string) => void;
}

export function DateShortcuts({ onSelect }: DateShortcutsProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        className="rounded-full bg-card hover:bg-accent/10 hover:text-accent hover:border-accent/30"
        onClick={() => onSelect(today, today)}
      >
        Today
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="rounded-full bg-card hover:bg-accent/10 hover:text-accent hover:border-accent/30"
        onClick={() => {
          const yest = format(subDays(new Date(), 1), 'yyyy-MM-dd');
          onSelect(yest, yest);
        }}
      >
        Yesterday
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="rounded-full bg-card hover:bg-accent/10 hover:text-accent hover:border-accent/30"
        onClick={() => onSelect(format(startOfWeek(new Date()), 'yyyy-MM-dd'), today)}
      >
        This Week
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="rounded-full bg-card hover:bg-accent/10 hover:text-accent hover:border-accent/30"
        onClick={() => onSelect(format(startOfMonth(new Date()), 'yyyy-MM-dd'), today)}
      >
        This Month
      </Button>
    </div>
  );
}
