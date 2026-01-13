"use client";

import { useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchParam } from "@/hooks/use-search-param";

export const SearchInput = () => {
  const [search, setSearch] = useSearchParam();
  const [value, setValue] = useState(search);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleClear = () => {
    setValue("");
    setSearch("");
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearch(value);
    inputRef.current?.blur();
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <form className="relative max-w-[720px] w-full" onSubmit={handleSubmit}>
        <Input
          value={value}
          onChange={handleChange}
          ref={inputRef}
          placeholder="Search"
          className="md:text-base placeholder:text-slate-500 px-12 w-full border border-transparent
          focus-visible:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.35)] bg-white/80
          rounded-full h-[46px] focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:bg-white"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 [&_svg]:size-5 rounded-full text-slate-500 hover:text-slate-800"
        >
          <SearchIcon />
        </Button>
        {value && (
          <Button
            onClick={handleClear}
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 [&_svg]:size-5 rounded-full text-slate-500 hover:text-slate-800"
          >
            <XIcon />
          </Button>
        )}
      </form>
    </div>
  );
};
