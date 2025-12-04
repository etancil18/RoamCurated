// components/ui/Checkbox.tsx
import React from 'react';

export type CheckboxProps = {
  /** Whether the checkbox is checked or not (controlled) */
  checked: boolean;
  /** Handler when the checkbox toggles */
  onChange: (checked: boolean) => void;
  /** Optional label to show next to the checkbox */
  label?: string;
  /** Optional id (useful for <label htmlFor> pairing) */
  id?: string;
  /** Disable the checkbox */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
};

export function Checkbox({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = '',
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="form-checkbox h-4 w-4 text-blue-600" 
      />
      {label && <span>{label}</span>}
    </label>
  );
}
