import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Input } from './input';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

export const ColorPicker = ({ color, onChange, className }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full h-10 p-1 ${className}`}
        >
          <div className="flex items-center gap-2 w-full">
            <div
              className="w-6 h-6 rounded border border-border flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <Input
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="border-none p-0 h-auto bg-transparent text-sm"
              placeholder="#000000"
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" side="bottom" align="start">
        <HexColorPicker color={color} onChange={onChange} />
        <div className="mt-3">
          <Input
            value={color}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};