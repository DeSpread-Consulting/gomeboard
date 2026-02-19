"use client";

import { useState, useRef, useEffect } from "react";
import type { ProjectItem } from "../actions";

interface Props {
  projects: ProjectItem[];
  selected: ProjectItem | null;
  onSelect: (project: ProjectItem) => void;
}

export default function ProjectSelector({ projects, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? projects.filter(
        (p) => p.ticker.toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-80">
      <div
        className={`flex items-center gap-2 bg-white border rounded-xl px-4 py-2.5 transition-all ${
          open ? "border-[#0037F0] ring-2 ring-[#0037F0]/10" : "border-gray-200"
        }`}
      >
        {selected?.logo && (
          <img
            src={selected.logo}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        )}
        <input
          type="text"
          placeholder="프로젝트 검색 (ticker)..."
          value={open ? query : selected ? selected.ticker : query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
        />
        <span className="text-xs text-gray-400">{projects.length}</span>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto z-50">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">
              No projects found
            </div>
          ) : (
            filtered.slice(0, 50).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                  selected?.id === p.id ? "bg-blue-50" : ""
                }`}
              >
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {p.ticker.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900">
                    {p.ticker}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                    p.tge
                      ? "bg-blue-100 text-blue-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {p.tge ? "Post" : "Pre"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
