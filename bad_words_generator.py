#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import random

import requests

# Language codes from https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
LANGS = [
    'ar', 'bg', 'cs', 'da', 'de', 'en', 'es', 'eo', 'fil', 'fi',
    'fr', 'fr-CA-u-sd-caqc', 'hu', 'hi', 'it', 'ja', 'kab', 'tlh',
    'ko', 'no', 'fa', 'pl', 'pt', 'ru', 'sv', 'th', 'tr'
]

BASE_URL = (
    "https://raw.githubusercontent.com/"
    "LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/"
    "master/{lang}"
)

all_words = []
for lang in LANGS:
    url = BASE_URL.format(lang=lang)
    try:
        print(f"Fetching {lang}…", end=' ')
        r = requests.get(url, timeout=10)
        if r.status_code == 404:
            print("404 — skipped")
            continue
        r.raise_for_status()
        words = [w.strip() for w in r.text.splitlines() if w.strip()]
        print(f"{len(words)} words")
        all_words.extend(words)
    except Exception as e:
        print(f"error ({e}), skipped")

# Delete duplicates
unique = list(set(all_words))
print(f"Total unique words: {len(unique)}")
random.shuffle(unique)

# Get 5000 random words
selected = unique[:5000]
print(f"Writing {len(selected)} words to bad_words.txt")

with open("bad_words.txt", "w", encoding="utf-8") as f:
    for w in selected:
        f.write(w + "\n")

print("Done.")
