import { Relation } from './types';
import { db } from './database';

export class PromptParser {
  parse(prompt: string): { success: boolean; message: string; relation?: Relation } {
    // Modifié pour prendre en charge les mots composés avec des tirets
    const segments = prompt.toLowerCase().trim().split(/\s+/);
    
    // Combiner les segments avec des tirets en un seul mot
    const words: string[] = [];
    let currentWord = '';
    
    for (const segment of segments) {
      if (segment.endsWith('-')) {
        // Si le segment se termine par un tiret, ajouter au mot en cours sans le tiret
        currentWord += segment.slice(0, -1);
      } else if (currentWord) {
        // Compléter le mot composé
        currentWord += segment;
        words.push(currentWord);
        currentWord = '';
      } else {
        // Mot normal
        words.push(segment);
      }
    }
    
    // S'il reste un mot composé incomplet à la fin
    if (currentWord) {
      words.push(currentWord);
    }
    
    if (words.length !== 3) {
      return {
        success: false,
        message: "Prompt must be in format: 'subject verb object'. Use hyphens to join multi-word components (e.g., 'I want-to sleep')."
      };
    }

    const [subjectStr, verbStr, objectStr] = words;

    // Find or create subject (assumed to be a person)
    const subject = db.findOrCreateName(subjectStr, "person");
    const subjectInstance = db.getActiveInstanceForName(subject.id);

    // Find or create verb
    const verb = db.findOrCreateVerb(verbStr);

    // Find or create object (assumed to be a thing)
    const object = db.findOrCreateName(objectStr, "thing");
    const objectInstance = db.getActiveInstanceForName(object.id);

    // Create new relation with instance IDs
    const relation = db.addRelation(
      subject.id, 
      verb.id, 
      object.id, 
      subjectInstance?.id, 
      objectInstance?.id
    );

    return {
      success: true,
      message: `Successfully added relation: ${subjectStr} ${verbStr} ${objectStr}`,
      relation
    };
  }
}