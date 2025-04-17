import React, { useState } from 'react';
import { PromptParser } from '../../parser';
import { db } from '../../database';
import { Relation, TimeType, Frequency } from '../../types';
import { notify } from '../../utils/toast';
import { Clock, Send, Info, Calendar, Edit, RepeatIcon, PlusCircle } from 'lucide-react';

const ParserPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; relation?: Relation } | null>(null);
  const [recentRelations, setRecentRelations] = useState<any[]>(db.getRelationsWithDetails().slice(0, 10));
  const [isLoading, setIsLoading] = useState(false);
  const [examples, setShowExamples] = useState(false);
  
  // Time edit modal states
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState<any | null>(null);
  const [timeType, setTimeType] = useState<TimeType>('specific');
  const [frequency, setFrequency] = useState<Frequency>('occasionally');
  const [customTime, setCustomTime] = useState('');
  
  const parser = new PromptParser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      notify.error('Please enter a prompt');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate slight delay for better UX
    setTimeout(() => {
      const parseResult = parser.parse(prompt);
      setResult(parseResult);
      
      if (parseResult.success) {
        setPrompt('');
        
        // Open time modal for the new relation
        if (parseResult.relation) {
          const newRelation = db.getRelationsWithDetails().find(r => r.id === parseResult.relation?.id);
          if (newRelation) {
            setSelectedRelation(newRelation);
            setTimeType('specific'); // Default to specific time
            setFrequency('occasionally');
            setCustomTime('');
            setShowTimeModal(true);
          }
        }
        
        // Refresh recent relations
        setRecentRelations(db.getRelationsWithDetails().slice(0, 10));
        notify.success(parseResult.message);
      } else {
        notify.error(parseResult.message);
      }
      
      setIsLoading(false);
    }, 300);
  };

  const handleEditTime = (relation: any) => {
    setSelectedRelation(relation);
    // Set defaults or load existing values
    setTimeType(relation.timeType || 'specific');
    setFrequency(relation.frequency || 'occasionally');
    setCustomTime(relation.customTime || '');
    setShowTimeModal(true);
  };

  const handleSaveTime = () => {
    if (!selectedRelation) return;
    
    try {
      // Create an updates object with temporal information
      const timeUpdates = {
        timeType,
        ...(timeType === 'recurring' ? { frequency } : {}),
        ...(timeType === 'specific' && customTime ? { customTime } : {})
      };
      
      // Update the relation in the database
      const success = db.updateRelationTime(selectedRelation.id, timeUpdates);
      
      if (success) {
        notify.success('Time information updated successfully');
        // Refresh the relations list
        setRecentRelations(db.getRelationsWithDetails().slice(0, 10));
        setShowTimeModal(false);
      } else {
        notify.error('Failed to update time information');
      }
    } catch (error) {
      console.error('Error updating time:', error);
      notify.error('An error occurred while updating time information');
    }
  };

  const getTimeDisplay = (relation: any) => {
    if (relation.timeType === 'general') {
      return 'General fact';
    } else if (relation.timeType === 'recurring') {
      return `Occurs ${relation.frequency || 'occasionally'}`;
    } else if (relation.customTime) {
      return relation.customTime;
    } else {
      return new Date(relation.timestamp).toLocaleString();
    }
  };

  const getTimeIcon = (relation: any) => {
    if (relation.timeType === 'general') {
      return <Info size={14} className="mr-1" />;
    } else if (relation.timeType === 'recurring') {
      return <RepeatIcon size={14} className="mr-1" />;
    } else {
      return <Clock size={14} className="mr-1" />;
    }
  };

  const examplePrompts = [
    "Daniel drinks coffee",
    "I want-to sleep",
    "Mary loves John",
    "The cat eats fish",
    "Students learn mathematics",
    "Fish swim in-the ocean"
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Prompt Parser</h1>
        <p className="text-gray-600">Parse natural language into subject-verb-object relations</p>
      </header>

      {/* Parser Input */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="prompt" className="text-sm font-medium text-gray-700">
              Enter a prompt
            </label>
            <div className="relative">
              <input
                id="prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Daniel drinks coffee' or 'I want-to sleep'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Processing</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Parse</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Info size={12} />
              Use hyphens to join multi-word components: "I want-to sleep", "Daniel likes ice-cream"
            </p>
          </div>
          
          {/* Examples */}
          <div>
            <button
              type="button"
              onClick={() => setShowExamples(!examples)}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              {examples ? 'Hide Examples' : 'Show Examples'}
            </button>
            
            {examples && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Example Prompts:</h3>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map(example => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setPrompt(example)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${
          result.success ? 'border-green-500' : 'border-red-500'
        }`}>
          <h2 className="text-lg font-medium mb-4">Parse Result</h2>
          
          <div className="mb-4">
            <div className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </div>
          </div>
          
          {result.success && result.relation && (
            <div className="p-4 rounded-lg bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Relation Details:</h3>
              <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(result.relation, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Recent Relations */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-4">Recent Relations</h2>
        
        {recentRelations.length > 0 ? (
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
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentRelations.map((relation) => (
                  <tr key={relation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        {getTimeIcon(relation)}
                        {getTimeDisplay(relation)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {relation.subject}
                        {relation.subjectInstance && (
                          <span className="text-xs text-gray-500 ml-1">
                            (#{relation.subjectInstance.id})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{relation.verb}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {relation.object}
                        {relation.objectInstance && (
                          <span className="text-xs text-gray-500 ml-1">
                            (#{relation.objectInstance.id})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditTime(relation)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit time"
                      >
                        <Calendar size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No relations found. Create some using the prompt parser above.
          </div>
        )}
      </div>

      {/* Time Edit Modal */}
      {showTimeModal && selectedRelation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">Edit Time Information</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">Relation:</span> {selectedRelation.subject} {selectedRelation.verb} {selectedRelation.object}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Type</label>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="specific"
                      checked={timeType === 'specific'}
                      onChange={() => setTimeType('specific')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Specific Time (happened once)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="recurring"
                      checked={timeType === 'recurring'}
                      onChange={() => setTimeType('recurring')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Recurring Event (happens regularly)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="general"
                      checked={timeType === 'general'}
                      onChange={() => setTimeType('general')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">General Fact (timeless)</span>
                  </label>
                </div>
              </div>
              
              {timeType === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    When did it happen?
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={!customTime}
                        onChange={() => setCustomTime('')}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2">Just now (created at {new Date(selectedRelation.timestamp).toLocaleString()})</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={!!customTime}
                        onChange={() => setCustomTime(new Date().toISOString())}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2">Custom time:</span>
                    </label>
                    {!!customTime && (
                      <input
                        type="datetime-local"
                        value={customTime.slice(0, 16)} // Format for datetime-local input
                        onChange={(e) => setCustomTime(new Date(e.target.value).toISOString())}
                        className="px-3 py-2 border rounded-md"
                      />
                    )}
                  </div>
                </div>
              )}
              
              {timeType === 'recurring' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How often does it occur?
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                    className="block w-full px-3 py-2 border rounded-md"
                  >
                    <option value="rarely">Rarely</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="frequently">Frequently</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTimeModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTime}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParserPage; 