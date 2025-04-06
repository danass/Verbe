import React, { useState, useEffect } from 'react';
import { Send, Plus, Edit2, BarChart2, Check, X, Trash2, Clock } from 'lucide-react';
import { db } from './database';
import { PromptParser } from './parser';
import { Relation, Analytics, Name, Instance, Verb } from './types';
import { Toaster } from 'react-hot-toast';
import { notify } from './utils/toast';
import EntityTree  from './components/EntityTree'

function App() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; relation?: Relation } | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  const [newInstanceField, setNewInstanceField] = useState({ key: '', value: '' });
  const parser = new PromptParser();

  const [nameSearch, setNameSearch] = useState('');
  const [verbSearch, setVerbSearch] = useState('');
  const [instanceSearch, setInstanceSearch] = useState('');

  // États pour l'édition des alias
  const [editingNameAlias, setEditingNameAlias] = useState<{
    nameId: number;
    alias: string;
    value: string;
  } | null>(null);
  const [editingVerbAlias, setEditingVerbAlias] = useState<{
    verbId: number;
    alias: string;
    value: string;
  } | null>(null);

  const [editingNameBase, setEditingNameBase] = useState<{
    nameId: number;
    value: string;
  } | null>(null);
  
  const [editingVerbBase, setEditingVerbBase] = useState<{
    verbId: number;
    value: string;
  } | null>(null);

  const [selectedNameForInstances, setSelectedNameForInstances] = useState<number | null>(null);
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);

  const [relations, setRelations] = useState<ReturnType<typeof db.getRelationsWithDetails>>([]);
  const [relationSearch, setRelationSearch] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<number | null>(null);
  
  useEffect(() => {
    loadRelations();
  }, []);
  
  const loadRelations = () => {
    setRelations(db.getRelationsWithDetails());
  };

  const filteredNames = db.getData().names.filter(name =>
    name.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
    name.aliases?.some(alias => alias.toLowerCase().includes(nameSearch.toLowerCase()))
  );

  const filteredVerbs = db.getData().verbs.filter(verb =>
    verb.verb.toLowerCase().includes(verbSearch.toLowerCase()) ||
    verb.aliases?.some(alias => alias.toLowerCase().includes(verbSearch.toLowerCase()))
  );

  const filteredInstances = db.getData().instances.filter(instance => {
    const name = db.getData().names.find(n => n.id === instance.name_id)?.name || '';
    return name.toLowerCase().includes(instanceSearch.toLowerCase());
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parseResult = parser.parse(prompt);
    setResult(parseResult);
    
    if (parseResult.success) {
      setPrompt('');
      updateAnalytics();
      loadRelations(); // Reload relations after adding a new one
      notify.success(parseResult.message);
    } else {
      notify.error(parseResult.message);
    }
  };

  const updateAnalytics = () => {
    setAnalytics(db.getAnalytics());
  };

  // Cette fonction est utilisée pour les opérations d'ajout de champs sur une instance
  const updateInstanceAttributes = (instance: Instance, updates: Record<string, any>): boolean => {
    return db.updateInstance(instance.id, updates);
  };

  const handleAddInstanceField = () => {
    if (editingInstance && newInstanceField.key.trim()) {
      const updates = {
        ...editingInstance.attributes,
        [newInstanceField.key]: newInstanceField.value
      };
      
      if (updateInstanceAttributes(editingInstance, updates)) {
        setNewInstanceField({ key: '', value: '' });
        notify.success(`Added new field "${newInstanceField.key}" to instance`);
        
        setEditingInstance({
          ...editingInstance,
          attributes: updates
        });
      }
    }
  };

  const handleSaveInstance = () => {
    if (editingInstance) {
      if (db.updateInstance(editingInstance.id, editingInstance.attributes)) {
        setEditingInstance(null);
        notify.success(`Saved instance attributes`);
      }
    }
  };

  const handleUpdateNameAlias = (nameId: number, oldAlias: string, newAlias: string) => {
    if (newAlias.trim() === '') {
      notify.error("Alias cannot be empty");
      return;
    }
    
    if (db.updateNameAlias(nameId, oldAlias, newAlias)) {
      notify.success(`Updated alias from "${oldAlias}" to "${newAlias}"`);
      setEditingNameAlias(null);
    } else {
      notify.error(`Failed to update alias "${oldAlias}"`);
    }
  };

  const handleUpdateVerbAlias = (verbId: number, oldAlias: string, newAlias: string) => {
    if (newAlias.trim() === '') {
      notify.error("Alias cannot be empty");
      return;
    }
    
    if (db.updateVerbAlias(verbId, oldAlias, newAlias)) {
      notify.success(`Updated alias from "${oldAlias}" to "${newAlias}"`);
      setEditingVerbAlias(null);
    } else {
      notify.error(`Failed to update alias "${oldAlias}"`);
    }
  };



  const handleUpdateNameBase = (nameId: number, newName: string) => {
    if (newName.trim() === '') {
      notify.error("Name cannot be empty");
      return;
    }
    
    if (db.updateNameBase(nameId, newName)) {
      notify.success(`Updated primary name to "${newName}"`);
      setEditingNameBase(null);
    } else {
      notify.error(`Failed to update name`);
    }
  };

  const handleUpdateVerbBase = (verbId: number, newVerb: string) => {
    if (newVerb.trim() === '') {
      notify.error("Verb cannot be empty");
      return;
    }
    
    if (db.updateVerbBase(verbId, newVerb)) {
      notify.success(`Updated primary verb to "${newVerb}"`);
      setEditingVerbBase(null);
    } else {
      notify.error(`Failed to update verb`);
    }
  };

  const handleCreateNewInstance = (nameId: number) => {
    const newInstance = db.createNewInstanceForName(nameId);
    if (newInstance) {
      // setEditingInstance(newInstance);
      notify.success(`Created new instance. All existing data preserved. Edit to differentiate this instance.`);
    }
  };

  const handleSetActiveInstance = (instanceId: number) => {
    if (db.setActiveInstance(instanceId)) {
      setShowInstanceSelector(false);
      notify.success(`Set instance as active. This instance will be used for future references.`);
    }
  };

  const handleDeleteInstance = (instanceId: number) => {
    const relationCount = db.getRelationCountForInstance(instanceId);
    
    if (relationCount > 0) {
      if (!window.confirm(`This instance is used in ${relationCount} relation${relationCount > 1 ? 's' : ''}. Deleting it will also delete these relations. Continue?`)) {
        return;
      }
    }
    
    if (db.deleteInstance(instanceId)) {
      notify.success(`Instance deleted successfully.`);
      loadRelations(); // Reload relations after deleting an instance
    } else {
      notify.error(`Failed to delete instance.`);
    }
  };

  const handleDeleteRelation = (relationId: number) => {
    if (db.deleteRelation(relationId)) {
      notify.success(`Relation deleted successfully.`);
      loadRelations();
      setDeleteConfirmation(null);
    } else {
      notify.error(`Failed to delete relation.`);
    }
  };

  const handleDeleteName = (nameId: number) => {
    const relationCount = db.getRelationCountForName(nameId);
    const name = db.getData().names.find(n => n.id === nameId);
    
    if (!name) return;
    
    if (relationCount > 0) {
      if (!window.confirm(`"${name.name}" is used in ${relationCount} relation${relationCount > 1 ? 's' : ''}. Deleting it will also delete these relations and all associated instances. Continue?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete "${name.name}" and all its instances?`)) {
        return;
      }
    }
    
    if (db.deleteName(nameId)) {
      notify.success(`Successfully deleted ${name.name} and all related data.`);
      loadRelations(); // Reload relations after deletion
    } else {
      notify.error(`Failed to delete ${name.name}.`);
    }
  };
  
  const handleDeleteVerb = (verbId: number) => {
    const relationCount = db.getRelationCountForVerb(verbId);
    const verb = db.getData().verbs.find(v => v.id === verbId);
    
    if (!verb) return;
    
    if (relationCount > 0) {
      if (!window.confirm(`"${verb.verb}" is used in ${relationCount} relation${relationCount > 1 ? 's' : ''}. Deleting it will also delete these relations. Continue?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete "${verb.verb}"?`)) {
        return;
      }
    }
    
    if (db.deleteVerb(verbId)) {
      notify.success(`Successfully deleted ${verb.verb} and all related data.`);
      loadRelations(); // Reload relations after deletion
    } else {
      notify.error(`Failed to delete ${verb.verb}.`);
    }
  };
  
  const filteredRelations = relations.filter(relation => {
    const searchTerms = relationSearch.toLowerCase();
    return relation.subject.toLowerCase().includes(searchTerms) ||
           relation.verb.toLowerCase().includes(searchTerms) ||
           relation.object.toLowerCase().includes(searchTerms);
  });

  // Correction des types pour les composants
  const NameCard = ({ name }: { name: Name }) => {
    const [specificNameAlias, setSpecificNameAlias] = useState('');
    
    return (
      <div className="border p-4 rounded-lg">
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="bg-blue-100 px-2 py-1 rounded text-sm flex items-center gap-2 font-semibold">
            {editingNameBase && editingNameBase.nameId === name.id ? (
              <>
                <input
                  type="text"
                  value={editingNameBase.value}
                  onChange={(e) => setEditingNameBase({
                    ...editingNameBase,
                    value: e.target.value
                  })}
                  className="w-24 px-1 py-0.5 border rounded"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdateNameBase(name.id, editingNameBase.value)}
                  className="text-green-500 hover:text-green-700"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingNameBase(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                {name.name} <span className="text-xs text-blue-600">(primary)</span>
                <button
                  onClick={() => setEditingNameBase({ nameId: name.id, value: name.name })}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Edit2 size={14} />
                </button>
              </>
            )}
          </span>
          
          {name.aliases && name.aliases.length > 0 && (
            name.aliases.map(alias => (
              <span key={alias} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-2">
                {editingNameAlias && editingNameAlias.nameId === name.id && editingNameAlias.alias === alias ? (
                  <>
                    <input
                      type="text"
                      value={editingNameAlias.value}
                      onChange={(e) => setEditingNameAlias({
                        ...editingNameAlias,
                        value: e.target.value
                      })}
                      className="w-20 px-1 py-0.5 border rounded"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateNameAlias(name.id, alias, editingNameAlias.value)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingNameAlias(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {alias}
                    <button
                      onClick={() => setEditingNameAlias({ nameId: name.id, alias, value: alias })}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (db.removeNameAlias(name.id, alias)) {
                          notify.success(`Removed alias "${alias}" from "${name.name}"`);
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={specificNameAlias}
              onChange={(e) => setSpecificNameAlias(e.target.value)}
              placeholder="New alias"
              className="px-2 py-1 border rounded"
            />
            <button
              onClick={() => {
                if (specificNameAlias.trim()) {
                  if (db.addAlias(name.id, specificNameAlias)) {
                    notify.success(`Added alias "${specificNameAlias}" to "${name.name}"`);
                    setSpecificNameAlias('');
                  }
                }
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
          <div>
            <button
              onClick={() => handleDeleteName(name.id)}
              className="text-red-500 hover:text-red-700 p-1 hover:bg-gray-100 rounded"
              title="Delete name and all its instances"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {db.getRelationCountForName(name.id)} relations
        </div>
      </div>
    );
  };

  const VerbCard = ({ verb }: { verb: Verb }) => {
    const [specificVerbAlias, setSpecificVerbAlias] = useState('');
    
    return (
      <div className="border p-4 rounded-lg">
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="bg-green-100 px-2 py-1 rounded text-sm flex items-center gap-2 font-semibold">
            {editingVerbBase && editingVerbBase.verbId === verb.id ? (
              <>
                <input
                  type="text"
                  value={editingVerbBase.value}
                  onChange={(e) => setEditingVerbBase({
                    ...editingVerbBase,
                    value: e.target.value
                  })}
                  className="w-24 px-1 py-0.5 border rounded"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdateVerbBase(verb.id, editingVerbBase.value)}
                  className="text-green-500 hover:text-green-700"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingVerbBase(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                {verb.verb} <span className="text-xs text-green-600">(primary)</span>
                <button
                  onClick={() => setEditingVerbBase({ verbId: verb.id, value: verb.verb })}
                  className="text-blue-500 hover:text-blue-700"
                >
                    <Edit2 size={14} />
                </button>
              </>
            )}
          </span>
          
          {verb.aliases && verb.aliases.length > 0 && (
            verb.aliases.map(alias => (
              <span key={alias} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-2">
                {editingVerbAlias && editingVerbAlias.verbId === verb.id && editingVerbAlias.alias === alias ? (
                  <>
                    <input
                      type="text"
                      value={editingVerbAlias.value}
                      onChange={(e) => setEditingVerbAlias({
                        ...editingVerbAlias,
                        value: e.target.value
                      })}
                      className="w-20 px-1 py-0.5 border rounded"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateVerbAlias(verb.id, alias, editingVerbAlias.value)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingVerbAlias(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {alias}
                    <button
                      onClick={() => setEditingVerbAlias({ verbId: verb.id, alias, value: alias })}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (db.removeVerbAlias(verb.id, alias)) {
                          notify.success(`Removed alias "${alias}" from "${verb.verb}"`);
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={specificVerbAlias}
              onChange={(e) => setSpecificVerbAlias(e.target.value)}
              placeholder="New alias"
              className="px-2 py-1 border rounded"
            />
            <button
              onClick={() => {
                if (specificVerbAlias.trim()) {
                  if (db.addVerbAlias(verb.id, specificVerbAlias)) {
                    notify.success(`Added alias "${specificVerbAlias}" to "${verb.verb}"`);
                    setSpecificVerbAlias('');
                  }
                }
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
          <div>
            <button
              onClick={() => handleDeleteVerb(verb.id)}
              className="text-red-500 hover:text-red-700 p-1 hover:bg-gray-100 rounded"
              title="Delete verb"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {db.getRelationCountForVerb(verb.id)} relations
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Toaster /> {/* Ajout du composant Toaster */}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Prompt Parser</h1>
            <button
              onClick={() => {
                setShowAnalytics(!showAnalytics);
                if (!showAnalytics) updateAnalytics();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              <BarChart2 size={20} />
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter prompt (e.g., 'Daniel drinks coffee' or 'I want-to sleep')"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                >
                  <Send size={20} />
                  Parse
                </button>
              </div>
              <p className="text-xs text-gray-500 italic">
                Use hyphens to join multi-word components: "I want-to sleep", "Daniel likes ice-cream"
              </p>
            </div>
          </form>

          {/* Nous pouvons garder ce bloc pour afficher les détails de la relation, mais le message est maintenant affiché via toast */}
          {result && result.success && result.relation && (
            <div className="p-4 rounded-lg bg-gray-50 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Last created relation:</h3>
              <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(result.relation, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {showAnalytics && analytics && (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium mb-2">By Subject</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.bySubject).map(([subject, data]) => (
                    <div key={subject} className="border p-4 rounded-lg">
                      <h3 className="font-bold">{subject} (Total: {data.total})</h3>
                      <div className="ml-4">
                        {Object.entries(data.actions).map(([verb, objects]) => (
                          <div key={verb} className="ml-2">
                            <h4 className="font-medium">{verb}</h4>
                            <ul className="ml-4">
                              {Object.entries(objects).map(([object, count]) => (
                                <li key={object}>
                                  {object}: {count}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">By Verb</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byVerb).map(([verb, count]) => (
                    <div key={verb} className="flex justify-between">
                      <span>{verb}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">By Object</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byObject).map(([object, count]) => (
                    <div key={object} className="flex justify-between">
                      <span>{object}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

<div className="mt-6">
  <h3 className="text-lg font-bold mb-4">Entity Tree</h3>
  <EntityTree />
</div>

        <div className="bg-white p-8 rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-bold mb-4">Entity Relationships Network</h2>
          <p className="text-gray-600 mb-4">
            This graph visualizes relationships between entities. Nodes represent entities (subjects and objects) and edges represent relationships (verbs). 
            You can drag nodes to rearrange the network.
          </p>
          <EntityTree />
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Entities</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Names</h3>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Search Names"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="space-y-4">
                {filteredNames.map(name => (
                  <NameCard key={name.id} name={name} />
                ))}
              </div>


              <div className="mt-4">
                <h3 className="font-medium mb-2">Verbs</h3>
                <input
                  type="text"
                  value={verbSearch}
                  onChange={(e) => setVerbSearch(e.target.value)}
                  placeholder="Search Verbs"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                
                <div className="space-y-4">
                  {filteredVerbs.map(verb => (
                    <VerbCard key={verb.id} verb={verb} />
                  ))}
                </div>

              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Instances</h3>
              <input
                type="text"
                value={instanceSearch}
                onChange={(e) => setInstanceSearch(e.target.value)}
                placeholder="Search Instances"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="space-y-4">
                {filteredInstances.map(instance => {
                  const name = db.getData().names.find(n => n.id === instance.name_id);
                  const isActive = instance.active;
                  const instancesForName = db.getInstancesForName(instance.name_id);
                  const totalInstancesForName = instancesForName.length;
                  const relationCount = db.getRelationCountForInstance(instance.id);
                  
                  return (
                    <div key={instance.id} className={`border p-4 rounded-lg ${isActive ? 'border-blue-500' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        {/* Supprimer la logique d'édition de nom d'instance */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {name?.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            (ID: {instance.id} | Relations: {relationCount})
                          </span>
                          {isActive && (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                          {totalInstancesForName > 1 && (
                            <button
                              onClick={() => {
                                setSelectedNameForInstances(instance.name_id);
                                setShowInstanceSelector(true);
                              }}
                              className="text-xs bg-gray-100 px-2 py-1 rounded ml-2 hover:bg-gray-200"
                            >
                              View Instances ({totalInstancesForName})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCreateNewInstance(instance.name_id)}
                            title="Create new instance"
                            className="text-green-500 hover:text-green-700 p-1 hover:bg-gray-100 rounded"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => setEditingInstance(instance)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteInstance(instance.id)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-gray-100 rounded"
                            title="Delete instance"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <pre className="text-sm bg-gray-50 p-2 rounded">
                        {JSON.stringify(instance.attributes, null, 2)}
                      </pre>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <div>
                          {instance.lastUsed && `Last used: ${new Date(instance.lastUsed).toLocaleString()}`}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>Relations: {db.getRelationCountForInstance(instance.id)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-bold mb-4">Relations</h2>
          
          <input
            type="text"
            value={relationSearch}
            onChange={(e) => setRelationSearch(e.target.value)}
            placeholder="Search Relations"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verb
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Object
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRelations.map((relation) => (
                  <tr key={relation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {relation.subject}
                          {relation.subjectInstance && (
                            <span className="text-xs text-gray-500 ml-1">
                              (#{relation.subjectInstance.id})
                            </span>
                          )}
                        </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center text-gray-500" title={new Date(relation.timestamp).toLocaleString()}>
                        <Clock size={14} className="mr-1" />
                        {new Date(relation.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {deleteConfirmation === relation.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-600">Confirm?</span>
                          <button
                            onClick={() => handleDeleteRelation(relation.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmation(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmation(relation.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredRelations.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No relations found. Create some relations using the prompt parser.
            </div>
          )}
        </div>

      </div>

      {editingInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Edit Instance</h3>
            <div className="space-y-4">
              {Object.entries(editingInstance.attributes).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700">{key}</label>
                  <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    value={value === null ? '' : value}
                    onChange={(e) => {
                      const updatedInstance = {
                        ...editingInstance, 
                        attributes: {
                          ...editingInstance.attributes,
                          [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value
                        }
                      };
                      setEditingInstance(updatedInstance);
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Add New Field</h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={newInstanceField.key}
                    onChange={(e) => setNewInstanceField({ ...newInstanceField, key: e.target.value })}
                    placeholder="Field name"
                    className="px-2 py-1 border rounded flex-1"
                  />
                  <input
                    type="text"
                    value={newInstanceField.value}
                    onChange={(e) => setNewInstanceField({ ...newInstanceField, value: e.target.value })}
                    placeholder="Value"
                    className="px-2 py-1 border rounded flex-1"
                  />
                  <button
                    onClick={handleAddInstanceField}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingInstance(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInstance}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instance Selector Modal */}
      {showInstanceSelector && selectedNameForInstances && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              Select Instance for {db.getData().names.find(n => n.id === selectedNameForInstances)?.name}
            </h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {db.getInstancesForName(selectedNameForInstances).map(instance => (
                <div 
                  key={instance.id} 
                  className={`border p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${instance.active ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => handleSetActiveInstance(instance.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">Instance #{instance.id}</span>
                      {instance.active && (
                        <span className="ml-2 text-xs text-blue-600">(Active)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {instance.lastUsed ? new Date(instance.lastUsed).toLocaleString() : 'Never used'}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center">
                        {db.getRelationCountForInstance(instance.id)} relations
                      </span>
                    </div>
                  </div>
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                    {JSON.stringify(instance.attributes, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => handleCreateNewInstance(selectedNameForInstances)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Create New Instance
              </button>
              <button
                onClick={() => setShowInstanceSelector(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;