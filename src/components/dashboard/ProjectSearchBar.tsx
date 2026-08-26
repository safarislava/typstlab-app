import React from 'react';
import { Search, X } from 'lucide-react';

interface ProjectSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ProjectSearchBar: React.FC<ProjectSearchBarProps> = ({
  searchQuery,
  onSearchChange
}) => {
  return (
    <div className="dashboard-toolbar">
      <div className="search-box">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => onSearchChange('')}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
