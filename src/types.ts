export interface Name {
  id: number;
  name: string;
  aliases?: string[];
  parent_id?: number;
  children?: Name[];
}

export interface Instance {
  id: number;
  name_id: number;
  attributes: {
    type: string;
    [key: string]: any;
  };
  active?: boolean;
  lastUsed?: string;
  parent_instance_id?: number;
}

export interface Verb {
  id: number;
  verb: string;
  aliases?: string[];
  attributes: {
    tense: string;
    lang?: string;
  };
}

export type TimeType = 'specific' | 'general' | 'recurring';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'occasionally' | 'rarely' | 'frequently';

export interface Relation {
  id: number;
  subject_id: number;
  verb_id: number;
  object_id: number;
  subject_instance_id?: number;
  object_instance_id?: number;
  timestamp: string;
  timeType?: TimeType;
  frequency?: Frequency;
  customTime?: string;
}

export interface Database {
  names: Name[];
  instances: Instance[];
  verbs: Verb[];
  relations: Relation[];
}

export interface Analytics {
  total: number;
  bySubject: { [subject: string]: { total: number; actions: { [verb: string]: { [object: string]: number } } } };
  byVerb: { [verb: string]: number };
  byObject: { [object: string]: number };
  timeline: TimelineData[];
  entityTree: EntityTreeNode[];
}

export interface TimelineData {
  timestamp: string;
  subject: string;
  verb: string;
  object: string;
  relationId: number;
  timeType?: TimeType;
  frequency?: Frequency;
  customTime?: string;
}

export interface EntityTreeNode {
  id: number;
  name: string;
  value: number;
  children?: EntityTreeNode[];
}