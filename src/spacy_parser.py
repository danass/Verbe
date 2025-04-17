import spacy
from typing import Dict, Any

class SpacyParser:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def parse(self, sentence: str) -> Dict[str, Any]:
        doc = self.nlp(sentence)
        result = {
            "entities": [],
            "verbs": [],
            "nuances": []
        }

        for token in doc:
            if token.pos_ in ["NOUN", "PROPN"]:  # Nouns or proper nouns
                result["entities"].append(token.text)
            elif token.pos_ == "VERB":  # Verbs
                result["verbs"].append(token.text)
            elif token.pos_ in ["ADJ", "ADV"]:  # Adjectives or adverbs
                result["nuances"].append({
                    "text": token.text,
                    "modifies": token.head.text
                })

        return result

# Exemple d'utilisation
if __name__ == "__main__":
    parser = SpacyParser()
    sentence = "I code good program carefully"
    parsed = parser.parse(sentence)
    print(parsed)