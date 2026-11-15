"""Query-time synonym expansion for product search.

OpenSearch handles typos (fuzziness); this handles different words for the same thing
("earphones" should find "Wireless Earbuds"). Expansion happens in the API, so it needs
no index changes or reindexing.
"""

import difflib
import re

SYNONYM_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({"earphones", "earphone", "earbuds", "earbud", "headphones", "headphone", "headset"}),
    frozenset({"laptop", "notebook"}),
    frozenset({"bottle", "flask"}),
    frozenset({"vacuum", "hoover"}),
    frozenset({"lamp", "light", "bulb"}),
)

_ALL_TERMS = sorted({term for group in SYNONYM_GROUPS for term in group})
MAX_TERMS = 12
MIN_FUZZY_LENGTH = 5  # short words ("lap" vs "lamp") are too ambiguous to guess at


def expand_query(query: str) -> str:
    """Return the query plus synonyms for any word that matches a group (typos allowed)."""
    tokens = re.findall(r"\w+", query.lower())
    terms = list(dict.fromkeys(tokens))
    for token in tokens:
        if token in _ALL_TERMS:
            match = token
        elif len(token) >= MIN_FUZZY_LENGTH:
            match = next(iter(difflib.get_close_matches(token, _ALL_TERMS, n=1, cutoff=0.85)), None)
        else:
            match = None
        if match is None:
            continue
        for group in SYNONYM_GROUPS:
            if match in group:
                terms.extend(sorted(group - set(terms)))
    if len(terms) == len(set(tokens)):
        return query  # nothing to expand: leave the user's text untouched
    return " ".join(terms[:MAX_TERMS])
