import React, { useEffect, useState } from 'react';
import { db } from '../../database';
import { Timeline } from '../Timeline';
import { TimelineData } from '../../types';
import { Calendar, Filter, RefreshCw } from 'lucide-react';

const TimelinePage: React.FC = () => {
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [filteredData, setFilteredData] = useState<TimelineData[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setIsLoading(true);
    const data = db.getAnalytics().timeline;
    setTimelineData(data);
    
    // Extract unique entities for filter dropdown
    const entities = new Set<string>();
    data.forEach(item => {
      entities.add(item.subject);
      entities.add(item.object);
    });
    setEntityOptions(Array.from(entities).sort());
    
    setFilteredData(data);
    setIsLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...timelineData];
    
    // Apply entity filter
    if (selectedEntity) {
      filtered = filtered.filter(
        item => item.subject === selectedEntity || item.object === selectedEntity
      );
    }
    
    // Apply timeframe filter
    const now = new Date();
    if (selectedTimeframe === 'today') {
      const today = new Date(now.setHours(0, 0, 0, 0));
      filtered = filtered.filter(item => new Date(item.timestamp) >= today);
    } else if (selectedTimeframe === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(item => new Date(item.timestamp) >= weekAgo);
    } else if (selectedTimeframe === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(item => new Date(item.timestamp) >= monthAgo);
    }
    
    setFilteredData(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedEntity, selectedTimeframe, timelineData]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Timeline</h1>
          <p className="text-gray-600">Chronological view of all relations</p>
        </div>
        <button 
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm text-gray-500 mb-1">Entity</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Entities</option>
              {entityOptions.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-500 mb-1">Timeframe</label>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSelectedTimeframe('all')}
                className={`px-3 py-1 rounded ${
                  selectedTimeframe === 'all' ? 'bg-white shadow' : ''
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedTimeframe('today')}
                className={`px-3 py-1 rounded ${
                  selectedTimeframe === 'today' ? 'bg-white shadow' : ''
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedTimeframe('week')}
                className={`px-3 py-1 rounded ${
                  selectedTimeframe === 'week' ? 'bg-white shadow' : ''
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setSelectedTimeframe('month')}
                className={`px-3 py-1 rounded ${
                  selectedTimeframe === 'month' ? 'bg-white shadow' : ''
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="h-[500px]">
            <Timeline data={filteredData} selectedEntity={selectedEntity} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <Calendar size={48} className="text-gray-300 mb-4" />
            <p>No timeline data available for the selected filters.</p>
            <button 
              onClick={() => {
                setSelectedEntity('');
                setSelectedTimeframe('all');
              }}
              className="mt-4 text-blue-500 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Timeline Events List */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-4">Timeline Events ({filteredData.length})</h2>
        
        {filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verb
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Object
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((event) => (
                    <tr key={event.relationId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {event.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{event.verb}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                          {event.object}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No events found</div>
        )}
      </div>
    </div>
  );
};

export default TimelinePage; 