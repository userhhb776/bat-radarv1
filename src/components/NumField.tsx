import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/** Campo numérico que deixa digitar livremente (ex.: "20") e só ajusta ao sair do campo. */
export function NumField({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(String(value)); }, [value]);
  return (
    <Input type="number" inputMode="numeric" min={min} max={max} value={txt}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && !Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      onBlur={() => {
        focused.current = false;
        const n = Number(txt);
        const v = txt.trim() === "" || Number.isNaN(n) ? min : Math.max(min, Math.min(max, n));
        setTxt(String(v)); onChange(v);
      }} />
  );
}
