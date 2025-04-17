import { Database, Analytics, Name, Instance, Verb, Relation, TimelineData, EntityTreeNode } from './types';

class DatabaseManager {
  private data: Database;
  private readonly STORAGE_KEY = 'database';

  constructor() {
    this.data = this.loadDatabase();
  }

  loadDatabase(): Database {
    const storedData = localStorage.getItem(this.STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData) as Database;
    } else {
      const defaultData: Database = {
        names: [],
        instances: [],
        verbs: [],
        relations: [],
      };
      this.saveDatabase(defaultData);
      return defaultData;
    }
  }

  private saveDatabase(data: Database): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  private updateDatabase(): void {
    this.saveDatabase(this.data);
  }

  getNextId(collection: { id: number }[]): number {
    return collection.length > 0 ? Math.max(...collection.map(item => item.id)) + 1 : 1;
  }

  findNameByString(nameStr: string): Name | undefined {
    return this.data.names.find(n => 
      n.name.toLowerCase() === nameStr.toLowerCase() ||
      n.aliases?.some(alias => alias.toLowerCase() === nameStr.toLowerCase())
    );
  }

  findOrCreateName(nameStr: string, type: string, parentId?: number): Name {
    let name = this.findNameByString(nameStr);
    if (!name) {
      name = {
        id: this.getNextId(this.data.names),
        name: nameStr,
        parent_id: parentId
      };
      this.data.names.push(name);

      // Create corresponding instance
      const parentInstance = parentId ? 
        this.data.instances.find(i => i.name_id === parentId && i.active) : undefined;

      // Utiliser l'opérateur de coalescence des nuls pour garantir un type number ou undefined
      // plutôt que d'accéder directement à la propriété qui pourrait être undefined
      const parentInstanceId = parentInstance?.id;

      const instance: Instance = {
        id: this.getNextId(this.data.instances),
        name_id: name.id,
        attributes: { type },
        active: true,
        lastUsed: new Date().toISOString(),
        // Si parent_instance_id est optionnel dans l'interface Instance, cette assignation est sûre
        parent_instance_id: parentInstanceId
      };
      this.data.instances.push(instance);
      this.updateDatabase();
    } else if (parentId && name.parent_id !== parentId) {
      // Update parent if different
      name.parent_id = parentId;
      
      // Update instance parent relationship
      const parentInstance = this.data.instances.find(i => i.name_id === parentId && i.active);
      const currentInstance = this.data.instances.find(i => i.name_id === name?.id && i.active);
      
      if (currentInstance && parentInstance) {
        currentInstance.parent_instance_id = parentInstance.id;
      }
      
      this.updateDatabase();
    }
    return name;
  }

  setParentEntity(childId: number, parentId: number | undefined): boolean {
    const child = this.data.names.find(n => n.id === childId);
    if (!child) return false;

    // If parent is undefined, we're removing the parent relationship
    if (parentId === undefined) {
      child.parent_id = undefined;
      
      // Update instances
      this.data.instances
        .filter(i => i.name_id === childId)
        .forEach(i => {
          i.parent_instance_id = undefined;
        });
    } else {
      const parent = this.data.names.find(n => n.id === parentId);
      if (!parent) return false;

      // Prevent circular references
      let currentParentId = parentId? parentId : undefined;
      while (currentParentId !== undefined) {
            if (currentParentId === childId) return false;
      const currentParent = this.data.names.find(n => n.id === currentParentId);
      if (!currentParent) break; 
      // Use optional chaining for safer access
      currentParentId = currentParent?.parent_id; // Corrected Line 81 
    }

      child.parent_id = parentId;

      // Update instances
      const parentInstance = this.data.instances.find(i => i.name_id === parentId && i.active);
      if (parentInstance) {
        this.data.instances
          .filter(i => i.name_id === childId)
          .forEach(i => {
            i.parent_instance_id = parentInstance.id;
          });
      }
    }

    this.updateDatabase();
    return true;
  }

  getEntityHierarchy(): Name[] {
    const result: Name[] = [];
    const nameMap = new Map<number, Name & { children: Name[] }>();

    // First pass: create map of all names with their children arrays
    this.data.names.forEach(name => {
      nameMap.set(name.id, { ...name, children: [] });
    });

    // Second pass: build hierarchy
    nameMap.forEach(name => {
      if (name.parent_id) {
        const parent = nameMap.get(name.parent_id);
        if (parent) {
          parent.children.push(name);
        } else {
          // If parent is not found, add to root level
          result.push(name);
        }
      } else {
        result.push(name);
      }
    });

    return result;
  }

  getEntityTree(): EntityTreeNode[] {
    const countRelations = (nameId: number): number => {
      return this.data.relations.filter(r => 
        r.subject_id === nameId || r.object_id === nameId
      ).length;
    };

    const buildNode = (name: Name): EntityTreeNode => {
      const children = this.data.names
        .filter(n => n.parent_id === name.id)
        .map(child => buildNode(child));

      return {
        id: name.id,
        name: name.name,
        value: countRelations(name.id),
        children: children.length > 0 ? children : undefined
      };
    };

    return this.data.names
      .filter(n => !n.parent_id)
      .map(name => buildNode(name));
  }

  getTimelineData(): TimelineData[] {
    return this.data.relations.map(relation => {
      const subject = this.data.names.find(n => n.id === relation.subject_id);
      const verb = this.data.verbs.find(v => v.id === relation.verb_id);
      const object = this.data.names.find(n => n.id === relation.object_id);

      return {
        timestamp: relation.timestamp,
        subject: subject?.name || 'Unknown',
        verb: verb?.verb || 'Unknown',
        object: object?.name || 'Unknown',
        relationId: relation.id
      };
    });
  }

  findOrCreateVerb(verbStr: string): Verb {
    let verb = this.data.verbs.find(v => 
      v.verb.toLowerCase() === verbStr.toLowerCase() ||
      v.aliases?.some(alias => alias.toLowerCase() === verbStr.toLowerCase())
    );
    if (!verb) {
      verb = {
        id: this.getNextId(this.data.verbs),
        verb: verbStr,
        attributes: { tense: "present" }
      };
      this.data.verbs.push(verb);
      this.updateDatabase();
    }
    return verb;
  }

  removeVerbAlias(verbId: number, alias: string): boolean {
    const verb = this.data.verbs.find(v => v.id === verbId);
    if (verb && verb.aliases) {
      const aliasIndex = verb.aliases.indexOf(alias);
      if (aliasIndex !== -1) {
        verb.aliases.splice(aliasIndex, 1);
        this.updateDatabase();
        return true;
      }
    }
    return false;
  }

  addVerbAlias(verbId: number, alias: string): boolean {
    const verb = this.data.verbs.find(v => v.id === verbId);
    if (!verb) return false;
  
    // Check if the alias corresponds to an existing verb or its aliases
    const existingVerb = this.data.verbs.find(v => 
      v.verb.toLowerCase() === alias.toLowerCase() ||
      v.aliases?.some(existingAlias => existingAlias.toLowerCase() === alias.toLowerCase())
    );
  
    if (existingVerb) {
      // Merge aliases and remove the duplicate verb
      if (!verb.aliases) verb.aliases = [];
      if (!existingVerb.aliases) existingVerb.aliases = [];
      
      // Add all aliases from the existing verb to the current verb
      verb.aliases = Array.from(new Set([...verb.aliases, ...existingVerb.aliases, existingVerb.verb]));
  
      // Update relations to reference the current verb ID
      this.data.relations.forEach(relation => {
        if (relation.verb_id === existingVerb.id) {
          relation.verb_id = verb.id;
        }
      });
  
      // Remove the existing verb from the list
      this.data.verbs = this.data.verbs.filter(v => v.id !== existingVerb.id);
  
      this.updateDatabase();
      return true;
    }
  
    // Add the alias if it doesn't already exist
    if (!verb.aliases) verb.aliases = [];
    if (!verb.aliases.includes(alias)) {
      verb.aliases.push(alias);
      this.updateDatabase();
      return true;
    }
  
    return false;
  }

  removeNameAlias(nameId: number, alias: string): boolean {
    const name = this.data.names.find(n => n.id === nameId);
    if (name && name.aliases) {
      const aliasIndex = name.aliases.indexOf(alias);
      if (aliasIndex !== -1) {
        name.aliases.splice(aliasIndex, 1);
        this.updateDatabase();
        return true;
      }
    }
    return false;
  }
  
  updateNameAlias(nameId: number, oldAlias: string, newAlias: string): boolean {
    const name = this.data.names.find(n => n.id === nameId);
    if (name && name.aliases) {
      const aliasIndex = name.aliases.indexOf(oldAlias);
      if (aliasIndex !== -1) {
        name.aliases[aliasIndex] = newAlias;
        this.updateDatabase();
        return true;
      }
    }
    return false;
  }

  updateVerbAlias(verbId: number, oldAlias: string, newAlias: string): boolean {
    const verb = this.data.verbs.find(v => v.id === verbId);
    if (verb && verb.aliases) {
      const aliasIndex = verb.aliases.indexOf(oldAlias);
      if (aliasIndex !== -1) {
        verb.aliases[aliasIndex] = newAlias;
        this.updateDatabase();
        return true;
      }
    }
    return false;
  }
  
  addRelation(subject_id: number, verb_id: number, object_id: number, subject_instance_id?: number, object_instance_id?: number): Relation {
    // Create a new relation with optional instance references
    const relation: Relation = {
      id: this.getNextId(this.data.relations),
      subject_id,
      verb_id,
      object_id,
      subject_instance_id: subject_instance_id,
      object_instance_id: object_instance_id,
      timestamp: new Date().toISOString()
    };
    
    this.data.relations.push(relation);
    this.updateDatabase();
    return relation;
  }

  getAnalytics(): Analytics {
    const analytics: Analytics = {
      total: this.data.relations.length,
      bySubject: {},
      byVerb: {},
      byObject: {},
      timeline: this.getTimelineData(),
      entityTree: this.getEntityTree()
    };
  
    this.data.relations.forEach(relation => {
      const subject = this.data.names.find(n => n.id === relation.subject_id)?.name || '';
      const verb = this.data.verbs.find(v => v.id === relation.verb_id)?.verb || '';
      const object = this.data.names.find(n => n.id === relation.object_id)?.name || '';
  
      if (!analytics.bySubject[subject]) {
        analytics.bySubject[subject] = { total: 0, actions: {} };
      }
      analytics.bySubject[subject].total += 1;
  
      if (!analytics.bySubject[subject].actions[verb]) {
        analytics.bySubject[subject].actions[verb] = {};
      }
      analytics.bySubject[subject].actions[verb][object] = 
        (analytics.bySubject[subject].actions[verb][object] || 0) + 1;
  
      analytics.byVerb[verb] = (analytics.byVerb[verb] || 0) + 1;
      analytics.byObject[object] = (analytics.byObject[object] || 0) + 1;
    });
  
    return analytics;
  }

  addAlias(nameId: number, alias: string): boolean {
    const name = this.data.names.find(n => n.id === nameId);
    if (!name) return false;
  
    // Check if the alias corresponds to an existing name or its aliases
    const existingName = this.data.names.find(n =>
      n.name.toLowerCase() === alias.toLowerCase() ||
      n.aliases?.some(existingAlias => existingAlias.toLowerCase() === alias.toLowerCase())
    );
  
    if (existingName) {
      // Merge aliases and remove the duplicate name
      if (!name.aliases) name.aliases = [];
      if (!existingName.aliases) existingName.aliases = [];
  
      // Add all aliases from the existing name to the current name
      name.aliases = Array.from(new Set([...name.aliases, ...existingName.aliases, existingName.name]));
  
      // Update instances to reference the current name ID
      this.data.instances.forEach(instance => {
        if (instance.name_id === existingName.id) {
          // Check if an instance with the same attributes already exists for the current name
          const duplicateInstance = this.data.instances.find(
            i => i.name_id === name.id && JSON.stringify(i.attributes) === JSON.stringify(instance.attributes)
          );
  
          if (duplicateInstance) {
            // Remove the duplicate instance
            this.data.instances = this.data.instances.filter(i => i.id !== instance.id);
          } else {
            // Update the instance to reference the current name ID
            instance.name_id = name.id;
          }
        }
      });
  
      // Update relations to reference the current name ID
      this.data.relations.forEach(relation => {
        if (relation.subject_id === existingName.id) {
          relation.subject_id = name.id;
        }
        if (relation.object_id === existingName.id) {
          relation.object_id = name.id;
        }
      });
  
      // Remove the existing name from the list
      this.data.names = this.data.names.filter(n => n.id !== existingName.id);
  
      this.updateDatabase();
      return true;
    }
  
    // Add the alias if it doesn't already exist
    if (!name.aliases) name.aliases = [];
    if (!name.aliases.includes(alias)) {
      name.aliases.push(alias);
      this.updateDatabase();
      return true;
    }
  
    return false;
  }

  updateInstance(id: number, attributes: Record<string, any>): boolean {
    const instance = this.data.instances.find(i => i.id === id);
    if (instance) {
      instance.attributes = { ...instance.attributes, ...attributes };
      this.updateDatabase();
      return true;
    }
    return false;
  }

  updateInstanceName(instanceId: number, nameId: number): boolean {
    const instance = this.data.instances.find(i => i.id === instanceId);
    if (!instance) return false;
    
    const name = this.data.names.find(n => n.id === nameId);
    if (!name) return false;
    
    instance.name_id = nameId;
    this.updateDatabase();
    return true;
  }

  updateNameBase(nameId: number, newName: string): boolean {
    const name = this.data.names.find(n => n.id === nameId);
    if (!name) return false;
    
    // Vérifier si le nouveau nom existe déjà
    const existingName = this.data.names.find(n => 
      n.id !== nameId && 
      (n.name.toLowerCase() === newName.toLowerCase() || 
        n.aliases?.some(alias => alias.toLowerCase() === newName.toLowerCase()))
    );
    
    if (existingName) {
      // Si le nom existe déjà, on pourrait fusionner les entités mais c'est complexe
      // Pour simplifier, on rejette simplement la modification
      return false;
    }
    
    name.name = newName;
    this.updateDatabase();
    return true;
  }

  updateVerbBase(verbId: number, newVerb: string): boolean {
    const verb = this.data.verbs.find(v => v.id === verbId);
    if (!verb) return false;
    
    // Vérifier si le nouveau verbe existe déjà
    const existingVerb = this.data.verbs.find(v => 
      v.id !== verbId && 
      (v.verb.toLowerCase() === newVerb.toLowerCase() || 
        v.aliases?.some(alias => alias.toLowerCase() === newVerb.toLowerCase()))
    );
    
    if (existingVerb) {
      // Si le verbe existe déjà, on rejette la modification
      return false;
    }
    
    verb.verb = newVerb;
    this.updateDatabase();
    return true;
  }

  createNewInstanceForName(nameId: number, attributes: Record<string, any> = {}): Instance | null {
    const name = this.data.names.find(n => n.id === nameId);
    if (!name) return null;
    
    // Deactivate all existing instances for this name
    this.data.instances
      .filter(i => i.name_id === nameId)
      .forEach(i => i.active = false);
    
    // Create new instance
    const newInstance: Instance = {
      id: this.getNextId(this.data.instances),
      name_id: nameId,
      attributes: { 
        type: attributes.type || 
          this.data.instances.find(i => i.name_id === nameId)?.attributes.type || 
          "thing" 
      },
      active: true,
      lastUsed: new Date().toISOString()
    };
    
    this.data.instances.push(newInstance);
    this.updateDatabase();
    return newInstance;
  }

  setActiveInstance(instanceId: number): boolean {
    const instance = this.data.instances.find(i => i.id === instanceId);
    if (!instance) return false;
    
    // Deactivate all instances for this name
    this.data.instances
      .filter(i => i.name_id === instance.name_id)
      .forEach(i => i.active = false);
    
    // Activate the selected instance
    instance.active = true;
    instance.lastUsed = new Date().toISOString();
    this.updateDatabase();
    return true;
  }

  getInstancesForName(nameId: number): Instance[] {
    return this.data.instances
      .filter(i => i.name_id === nameId)
      .sort((a, b) => 
        new Date(b.lastUsed || '1970-01-01').getTime() - 
        new Date(a.lastUsed || '1970-01-01').getTime()
      );
  }

  getActiveInstanceForName(nameId: number): Instance | null {
    const instances = this.getInstancesForName(nameId);
    return instances.find(i => i.active) || (instances.length > 0 ? instances[0] : null);
  }

  getRelationCountForInstance(instanceId: number): number {
    return this.data.relations.filter(r => 
      r.subject_instance_id === instanceId || r.object_instance_id === instanceId
    ).length;
  }

  getData(): Database {
    return this.data;
  }

  deleteInstance(instanceId: number): boolean {
    const instance = this.data.instances.find(i => i.id === instanceId);
    if (!instance) return false;
    
    // Remove related relations
    this.data.relations = this.data.relations.filter(r => 
      !(r.subject_instance_id === instanceId || r.object_instance_id === instanceId)
    );
    
    // Remove the instance
    this.data.instances = this.data.instances.filter(i => i.id !== instanceId);
    
    // If this was an active instance, make another instance active
    const instances = this.getInstancesForName(instance.name_id);
    if (instances.length > 0 && instance.active) {
      instances[0].active = true;
    }
    
    this.updateDatabase();
    return true;
  }
  
  getRelationsWithDetails(): Array<{
    id: number;
    subject: string;
    verb: string;
    object: string;
    subjectInstance?: Instance;
    objectInstance?: Instance;
    timestamp: string;
    timeType?: string;
    frequency?: string;
    customTime?: string;
  }> {
    return this.data.relations.map(relation => {
      const subject = this.data.names.find(n => n.id === relation.subject_id);
      const verb = this.data.verbs.find(v => v.id === relation.verb_id);
      const object = this.data.names.find(n => n.id === relation.object_id);
      const subjectInstance = relation.subject_instance_id ? 
        this.data.instances.find(i => i.id === relation.subject_instance_id) : undefined;
      const objectInstance = relation.object_instance_id ? 
        this.data.instances.find(i => i.id === relation.object_instance_id) : undefined;
      
      return {
        id: relation.id,
        subject: subject?.name || 'Unknown',
        verb: verb?.verb || 'Unknown',
        object: object?.name || 'Unknown',
        subjectInstance,
        objectInstance,
        timestamp: relation.timestamp,
        timeType: relation.timeType,
        frequency: relation.frequency,
        customTime: relation.customTime
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  deleteRelation(relationId: number): boolean {
    const relationExists = this.data.relations.some(r => r.id === relationId);
    if (!relationExists) return false;
    
    this.data.relations = this.data.relations.filter(r => r.id !== relationId);
    this.updateDatabase();
    return true;
  }

  deleteName(nameId: number): boolean {
    const name = this.data.names.find(n => n.id === nameId);
    if (!name) return false;
    
    // Check if this name is used in any relations
    const relationsWithName = this.data.relations.filter(r => 
      r.subject_id === nameId || r.object_id === nameId
    );
    
    if (relationsWithName.length > 0) {
      // We need to remove all relations that reference this name
      this.data.relations = this.data.relations.filter(r => 
        r.subject_id !== nameId && r.object_id !== nameId
      );
    }
    
    // Delete all instances associated with this name
    this.data.instances = this.data.instances.filter(i => i.name_id !== nameId);
    
    // Remove the name itself
    this.data.names = this.data.names.filter(n => n.id !== nameId);
    
    this.updateDatabase();
    return true;
  }
  
  deleteVerb(verbId: number): boolean {
    const verb = this.data.verbs.find(v => v.id === verbId);
    if (!verb) return false;
    
    // Check if this verb is used in any relations
    const relationsWithVerb = this.data.relations.filter(r => r.verb_id === verbId);
    
    if (relationsWithVerb.length > 0) {
      // We need to remove all relations that reference this verb
      this.data.relations = this.data.relations.filter(r => r.verb_id !== verbId);
    }
    
    // Remove the verb itself
    this.data.verbs = this.data.verbs.filter(v => v.id !== verbId);
    
    this.updateDatabase();
    return true;
  }
  
  getRelationCountForName(nameId: number): number {
    return this.data.relations.filter(r => 
      r.subject_id === nameId || r.object_id === nameId
    ).length;
  }
  
  getRelationCountForVerb(verbId: number): number {
    return this.data.relations.filter(r => r.verb_id === verbId).length;
  }

  updateRelationTime(relationId: number, updates: { 
    timeType?: string;
    frequency?: string;
    customTime?: string;
  }): boolean {
    const relation = this.data.relations.find(r => r.id === relationId);
    if (!relation) return false;
    
    // Update relation fields
    if (updates.timeType) {
      relation.timeType = updates.timeType as any;
    }
    
    if (updates.frequency) {
      relation.frequency = updates.frequency as any;
    }
    
    if (updates.customTime) {
      relation.customTime = updates.customTime;
    }
    
    this.updateDatabase();
    return true;
  }
}

export const db = new DatabaseManager();