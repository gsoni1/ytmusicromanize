# YouTube Music Pronunciation 🎵✨

A Chrome extension that brings Apple Music’s Lyrics Pronunciation feature to YouTube Music—making non-Latin lyrics instantly readable in Roman script.

# Overview

In iOS 26, Apple Music introduced Lyrics Translation and Lyrics Pronunciation to help users understand and sing along to global music more easily:
- Lyrics Translation → Shows real-time translated lyrics in the listener’s preferred language.
-	Lyrics Pronunciation → Shows romanized (phonetic) versions of lyrics, making it possible to sing along even if you don’t know the script.

These features, however, are:
-	Limited to Apple Music on iPhone and iPad
-	Available for a small set of languages and supported tracks only
-	Not available for YouTube Music, despite its massive international fanbase

That’s where YouTube Music Pronunciation comes in.
It’s a Chrome extension that brings Apple’s Lyrics Pronunciation-style feature to YouTube Music, so anyone can sing along to their favorite songs—no matter the language.

# ✨ Features

## 🔘 Pronunciation Button
- Adds a “Pronunciation” button directly inside YouTube Music (next to the Lyrics tab).
- Toggle between original and pronounced (romanized) lyrics in one click.

## 🌍 Multi-Language Support

Unlike Apple Music’s limited language pairs, this extension supports romanization across all major scripts:

- Hindi / Devanagari (हिंदी)
-	Arabic (العربية)
-	Chinese (中文)
-	Japanese (日本語)
-	Korean (한국어)
-	Thai (ไทย)
-	Russian / Cyrillic (Русский)
-	…and more!

## Smart Detection & Management
- Detects non-Latin text automatically and preserves English/Latin text.
- Handles mixed-language lyrics intelligently.
- Refreshes lyrics automatically when songs change.
- Uses deferred processing (only runs when you open the Lyrics tab).

## ⚡ Performance & Reliability
-	Caching: Stores romanized lyrics per song for instant toggling.
-	Error Handling: Gracefully falls back to original lyrics if pronunciation fails.
-	Lightweight: Designed for speed and minimal performance impact.

# Screenshots
Before & After (Apple-style Pronunciation in YouTube Music):

# 🔧 Installation
1.	Clone or download this repository.
2.	Open Chrome and go to: chrome://extensions/
3.	Enable Developer Mode (toggle in top-right corner).
4.	Click “Load unpacked” and select the extension folder.
5.	Open YouTube Music and start singing along!

# Usage
1. Play a song with non-Latin lyrics on YouTube Music.
2.	Open the Lyrics tab.
3.	Click the Pronunciation button.
4.	Switch between original and pronounced (romanized) lyrics anytime.

# 🛠️ Technical Details
-	Manifest V3 Chrome extension
-	Content Script → Injects button, manages UI, and watches for lyric updates
-	Background Script → Handles romanization via Google Translate API
-	MutationObserver → Detects dynamic lyric/tab content changes
-	Caching & State Management → Keeps toggling fast and efficient

# 🔒 Privacy
- No data collection or analytics.
- Lyrics are processed using Google Translate.
- Cached pronunciations are stored locally for the session only.

# 🤝 Contributing

Contributions are welcome!
- Open issues for bugs/feature requests
- Submit pull requests

✨ Inspired by Apple Music, built for YouTube Music fans everywhere.
