import { db } from './database';
import { Relation } from './types';

export class PromptParser {
  parse(prompt: string): { success: boolean; message: string; relation?: Relation } {
    try {
      // Simple regex-based parsing instead of Python script
      const words = prompt.split(' ');
      
      if (words.length < 3) {
        return {
          success: false,
          message: 'Prompt must have at least 3 words (subject, verb, object)'
        };
      }
      
      // Simple parsing: First word is subject, second is verb, rest is object
      const subjectStr = words[0];
      const verbStr = words[1];
      const objectStr = words.slice(2).join(' ');
      
      // Create relation in database
      const relation = this.createRelation(subjectStr, verbStr, objectStr);
      
      if (!relation) {
        return {
          success: false,
          message: 'Failed to create relation'
        };
      }
      
      return {
        success: true,
        message: `Created relation: ${subjectStr} ${verbStr} ${objectStr}`,
        relation
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error parsing prompt: ${error.message}`
      };
    }
  }

  // Helper method to create a relation from string inputs
  createRelation(subjectStr: string, verbStr: string, objectStr: string): Relation | null {
    try {
      // Find or create subject name and get active instance
      const subjectName = db.findOrCreateName(subjectStr, 'entity');
      const subjectInstance = db.getActiveInstanceForName(subjectName.id);
      
      // Find or create verb
      const verb = db.findOrCreateVerb(verbStr);
      
      // Find or create object name and get active instance
      const objectName = db.findOrCreateName(objectStr, 'entity');
      const objectInstance = db.getActiveInstanceForName(objectName.id);
      
      // Create the relation
      const relation = db.addRelation(
        subjectName.id,
        verb.id,
        objectName.id,
        subjectInstance?.id,
        objectInstance?.id
      );
      
      return relation;
    } catch (error) {
      console.error('Error creating relation:', error);
      return null;
    }
  }
}