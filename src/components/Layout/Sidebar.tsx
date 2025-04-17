import React from 'react';
import { 
  Home, 
  MessageSquare
} from 'lucide-react';

type SidebarItem = {
  name: string;
  icon: React.ReactNode;
  link: string;
};

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const menuItems: SidebarItem[] = [
    { name: 'Dashboard', icon: <Home size={20} />, link: 'dashboard' },
    { name: 'Prompt Parser', icon: <MessageSquare size={20} />, link: 'parser' },
  ];

  return (
    <div className="bg-white h-screen w-64 border-r border-gray-200 flex flex-col shadow-sm">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-blue-600">JournAI</h1>
        <p className="text-xs text-gray-500">Knowledge Graph Builder</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.name}>
              <button
                onClick={() => onNavigate(item.link)}
                className={`flex items-center w-full p-3 rounded-lg text-left transition-colors ${
                  activePage === item.link
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t text-xs text-gray-500">
        JournAI v1.0.0
      </div>
    </div>
  );
};

export default Sidebar; 