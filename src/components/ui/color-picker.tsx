import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';


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
          className={`w-full h-8 p-1 ${className}`}
        >
          <div className="flex items-center gap-2 w-full">
            <div
              className="w-5 h-5 rounded border border-border flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="bottom" align="start">
        <HexColorPicker color={color} onChange={onChange} style={{ width: 160, height: 160 }} />
      </PopoverContent>
    </Popover>
  );
};