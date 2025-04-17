import React, { useEffect, useState } from 'react';
import { db } from '../../database';
import { Analytics, Name, Verb } from '../../types';
import EntityTree from '../EntityTree';
import { Clock, Database, MessageSquare, Share2, X, Edit2, Plus, Trash2, Save } from 'lucide-react';
import { notify } from '../../utils/toast';

interface EditingEntity {
  id: number;
  name: string;
  aliases?: string[];
}

interface EditingVerb {
  verb: string;
  aliases?: string[];
}

const Dashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentRelations, setRecentRelations] = useState<any[]>([]);
  
  // Modal states
  const [showEntitiesModal, setShowEntitiesModal] = useState(false);
  const [showRelationsModal, setShowRelationsModal] = useState(false);
  const [showVerbsModal, setShowVerbsModal] = useState(false);
  
  // Edit states
  const [editingEntity, setEditingEntity] = useState<EditingEntity | null>(null);
  const [editingVerb, setEditingVerb] = useState<EditingVerb | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [entityRename, setEntityRename] = useState('');
  const [verbRename, setVerbRename] = useState('');
  
  useEffect(() => {
    setAnalytics(db.getAnalytics());
    const relations = db.getRelationsWithDetails();
    setRecentRelations(relations.slice(0, 5));
  }, []);
  
  const handleAddAlias = (type: 'entity' | 'verb') => {
    if (!newAlias.trim()) return;
    
    try {
      if (type === 'entity' && editingEntity) {
        db.addAlias(editingEntity.id, newAlias.trim());
        setEditingEntity({
          ...editingEntity,
          aliases: [...(editingEntity.aliases || []), newAlias.trim()]
        });
        notify.success('Entity alias added successfully');
      } else if (type === 'verb' && editingVerb) {
        const verb = db.getData().verbs.find(v => v.verb === editingVerb.verb);
        if (verb) {
          db.addVerbAlias(verb.id, newAlias.trim());
          setEditingVerb({
            ...editingVerb,
            aliases: [...(editingVerb.aliases || []), newAlias.trim()]
          });
          notify.success('Verb alias added successfully');
        }
      }
      setNewAlias('');
    } catch (error) {
      notify.error('Failed to add alias');
    }
  };

  const handleRemoveAlias = (type: 'entity' | 'verb', alias: string) => {
    try {
      if (type === 'entity' && editingEntity) {
        db.removeNameAlias(editingEntity.id, alias);
        setEditingEntity({
          ...editingEntity,
          aliases: (editingEntity.aliases || []).filter(a => a !== alias)
        });
        notify.success('Entity alias removed successfully');
      } else if (type === 'verb' && editingVerb) {
        const verb = db.getData().verbs.find(v => v.verb === editingVerb.verb);
        if (verb) {
          db.removeVerbAlias(verb.id, alias);
          setEditingVerb({
            ...editingVerb,
            aliases: (editingVerb.aliases || []).filter(a => a !== alias)
          });
          notify.success('Verb alias removed successfully');
        }
      }
    } catch (error) {
      notify.error('Failed to remove alias');
    }
  };
  
  // Entity rename
  const handleEntityRename = () => {
    if (editingEntity && entityRename.trim()) {
      try {
        const success = db.updateNameBase(editingEntity.id, entityRename.trim());
        if (success) {
          setEditingEntity({ ...editingEntity, name: entityRename.trim() });
          notify.success('Entity renamed successfully');
          setEntityRename('');
          setShowEntitiesModal(false);
          setEditingEntity(null);
        } else {
          notify.error('Entity name already exists or failed to rename');
        }
      } catch (e) {
        notify.error('Failed to rename entity');
      }
    }
  };

  // Entity delete
  const handleEntityDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this entity?')) {
      db.deleteName(id);
      notify.success('Entity deleted');
      setShowEntitiesModal(false);
      setEditingEntity(null);
    }
  };

  // Verb rename
  const handleVerbRename = () => {
    if (editingVerb && verbRename.trim()) {
      try {
        const verbObj = db.getData().verbs.find(v => v.verb === editingVerb.verb);
        if (verbObj) {
          const success = db.updateVerbBase(verbObj.id, verbRename.trim());
          if (success) {
            setEditingVerb({ ...editingVerb, verb: verbRename.trim() });
            notify.success('Verb renamed successfully');
            setVerbRename('');
            setShowVerbsModal(false);
            setEditingVerb(null);
          } else {
            notify.error('Verb already exists or failed to rename');
          }
        }
      } catch (e) {
        notify.error('Failed to rename verb');
      }
    }
  };

  // Verb delete
  const handleVerbDelete = (verb: string) => {
    if (window.confirm('Are you sure you want to delete this verb?')) {
      const v = db.getData().verbs.find(v => v.verb === verb);
      if (v) {
        db.deleteVerb(v.id);
        notify.success('Verb deleted');
        setShowVerbsModal(false);
        setEditingVerb(null);
      }
    }
  };

  // Relation delete
  const handleRelationDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this relation?')) {
      db.deleteRelation(id);
      notify.success('Relation deleted');
      setShowRelationsModal(false);
    }
  };
  
  if (!analytics) return <div>Loading...</div>;
  
  const stats = [
    {
      title: 'Total Entities',
      value: db.getData().names.length,
      icon: <Database className="h-6 w-6 text-blue-600" />,
      color: 'blue',
      onClick: () => setShowEntitiesModal(true)
    },
    {
      title: 'Total Relations',
      value: analytics.total,
      icon: <Share2 className="h-6 w-6 text-green-600" />,
      color: 'green',
      onClick: () => setShowRelationsModal(true)
    },
    {
      title: 'Unique Verbs',
      value: Object.keys(analytics.byVerb).length,
      icon: <MessageSquare className="h-6 w-6 text-purple-600" />,
      color: 'purple',
      onClick: () => setShowVerbsModal(true)
    },
    {
      title: 'Active Instances',
      value: db.getData().instances.filter(i => i.active).length,
      icon: <Clock className="h-6 w-6 text-orange-600" />,
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Overview of your knowledge graph</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.title} 
            className={`bg-white rounded-lg shadow p-6 ${stat.onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            onClick={stat.onClick}
          >
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full bg-${stat.color}-100`}>
                {stat.icon}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">{stat.title}</h3>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout for charts and recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm lg:col-span-2" style={{ minHeight: 880, height: 880 }}>
          <h2 className="text-lg font-medium mb-4">Entity Relationships Network</h2>
          <div className="h-80">
            <EntityTree />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentRelations.length > 0 ? (
              recentRelations.map((relation) => (
                <div key={relation.id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {relation.subject} → {relation.object}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(relation.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                      {relation.verb}
                    </span>
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Entities Modal */}
      {showEntitiesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">All Entities</h2>
              <button onClick={() => setShowEntitiesModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {db.getData().names.map((entity: Name) => (
                <div key={entity.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{entity.name}</h3>
                    <button 
                      onClick={() => setEditingEntity({
                        id: entity.id,
                        name: entity.name,
                        aliases: entity.aliases
                      })}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  {editingEntity?.id === entity.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={entityRename}
                          onChange={(e) => setEntityRename(e.target.value)}
                          placeholder="Enter new name"
                          className="flex-1 px-3 py-1 border rounded"
                        />
                        <button
                          onClick={handleEntityRename}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entity.aliases?.map(alias => (
                          <span key={alias} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                            {alias}
                            <button
                              onClick={() => handleRemoveAlias('entity', alias)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {entity.aliases?.map(alias => (
                        <span key={alias} className="px-2 py-1 bg-gray-100 rounded">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Relations Modal */}
      {showRelationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">All Relations</h2>
              <button onClick={() => setShowRelationsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {db.getRelationsWithDetails().map(relation => (
                <div key={relation.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{relation.subject}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {relation.verb}
                    </span>
                    <span className="font-medium">{relation.object}</span>
                  </div>
                  {relation.timeType && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Time:</span> {relation.timeType}
                      {relation.frequency && ` (${relation.frequency})`}
                      {relation.customTime && ` - ${new Date(relation.customTime).toLocaleString()}`}
                    </div>
                  )}
                  <button
                    onClick={() => handleRelationDelete(relation.id)}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verbs Modal */}
      {showVerbsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">All Verbs</h2>
              <button onClick={() => setShowVerbsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {db.getData().verbs.map((verb: Verb) => (
                <div key={verb.verb} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{verb.verb}</h3>
                    <button 
                      onClick={() => setEditingVerb({
                        verb: verb.verb,
                        aliases: verb.aliases
                      })}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  {editingVerb?.verb === verb.verb ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={verbRename}
                          onChange={(e) => setVerbRename(e.target.value)}
                          placeholder="Enter new verb"
                          className="flex-1 px-3 py-1 border rounded"
                        />
                        <button
                          onClick={handleVerbRename}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {verb.aliases?.map(alias => (
                          <span key={alias} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                            {alias}
                            <button
                              onClick={() => handleRemoveAlias('verb', alias)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {verb.aliases?.map(alias => (
                        <span key={alias} className="px-2 py-1 bg-gray-100 rounded">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 