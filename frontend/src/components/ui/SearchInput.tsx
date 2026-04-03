import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, placeholder = 'Search...', onChange }) => {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-base pl-9"
      />
    </div>
  );
};

export default SearchInput;
