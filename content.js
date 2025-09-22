// Store original lyrics for toggling
let originalLyricsContent = null;
let originalLyricsText = null; // Cache the original text content
let lyricsElement = null;

// No popup message handling needed for romanization-only functionality

// Cache for romanized lyrics (cleared when URL changes)
let romanizedCache = {
  url: null,
  text: null
};


// Function to detect and extract non-Latin text that needs romanization
function extractNonLatinText(text) {
  // Regular expression to match non-Latin scripts
  // Includes: Devanagari, Gurmukhi, Arabic, Chinese/Japanese/Korean, Cyrillic, etc.
  const nonLatinRegex = /[\u0900-\u097F\u0A00-\u0A7F\u0600-\u06FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+/g;
  
  const nonLatinParts = text.match(nonLatinRegex);
  
  if (!nonLatinParts || nonLatinParts.length === 0) {
    console.log('No non-Latin text found, no romanization needed');
    return null;
  }
  
  // Join all non-Latin parts with newlines to preserve structure
  const nonLatinText = nonLatinParts.join('\n');
  console.log('Extracted non-Latin text for romanization:', nonLatinText.substring(0, 100) + '...');
  
  return nonLatinText;
}

// Function to merge romanized text back with original text
function mergeRomanizedText(originalText, romanizedText) {
  // Split romanized text back into parts
  const romanizedParts = romanizedText.split('\n').filter(part => part.trim());
  
  // Replace non-Latin text with romanized versions
  let result = originalText;
  const nonLatinRegex = /[\u0900-\u097F\u0A00-\u0A7F\u0600-\u06FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+/g;
  
  let partIndex = 0;
  result = result.replace(nonLatinRegex, (match) => {
    if (partIndex < romanizedParts.length) {
      const replacement = romanizedParts[partIndex];
      partIndex++;
      console.log('Replacing:', match.substring(0, 30), '→', replacement.substring(0, 30));
      return replacement;
    }
    return match; // Fallback to original if no replacement available
  });
  
  return result;
}

// Main romanization function using background script
async function romanizeText(text) {
  // Extract only non-Latin text for romanization
  const nonLatinText = extractNonLatinText(text);

  if (!nonLatinText) {
    // No non-Latin text found, return original
    return text;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'romanizeText', text: nonLatinText },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          // Merge romanized text back with original
          const mergedText = mergeRomanizedText(text, response.romanizedText);
          resolve(mergedText);
        } else {
          reject(new Error(response.error || 'Failed to romanize text'));
        }
      }
    );
  });
}


// Function to find and store lyrics
function findAndStoreLyrics() {
  const lyricsSelector = 'yt-formatted-string.non-expandable.description.style-scope.ytmusic-description-shelf-renderer';
  lyricsElement = document.querySelector(lyricsSelector);

  console.log('Looking for lyrics with selector:', lyricsSelector);
  console.log('Found lyrics element:', lyricsElement);

  if (lyricsElement) {
    // Only cache original content if we haven't already (to preserve the true original)
    if (originalLyricsContent === null) {
      originalLyricsContent = lyricsElement.innerHTML;
      originalLyricsText = lyricsElement.textContent;
      console.log('Cached original lyrics content and text');
    }
    console.log('Lyrics content preview:', lyricsElement.textContent.substring(0, 100) + '...');
    return true;
  }
  console.log('No lyrics found');
  return false;
}

// Function to show romanized lyrics
async function showRomanizedLyrics() {
  console.log('showRomanizedLyrics called');
  
  if (!findAndStoreLyrics()) {
    console.log('Lyrics not found, retrying...');
    setTimeout(showRomanizedLyrics, 1000);
    return;
  }

  // Always use the cached original text, not the current element content
  const originalText = originalLyricsText;
  console.log('Using cached original text for romanization:', originalText.substring(0, 100) + '...');

  // Check if lyrics are already in English characters (no romanization needed)
  const nonLatinText = extractNonLatinText(originalText);
  if (!nonLatinText) {
    console.log('Lyrics are already in English characters, doing nothing');
    
    // Reset button state since we're not actually romanizing
    const romanizedButton = document.querySelector('#romanized-lyrics-btn');
    if (romanizedButton) {
      romanizedButton.setAttribute('aria-pressed', 'false');
    }
    
    // Do nothing - leave original lyrics unchanged
    return;
  }

  const currentUrl = window.location.href;
  
  // Check if we have cached romanized text for this URL
  if (romanizedCache.url === currentUrl && romanizedCache.text) {
    console.log('Using cached romanized text');
    displayRomanizedLyrics(originalText, romanizedCache.text, 'Romanized lyrics • Cached');
    return;
  }
  
  // Show loading state
  const loadingContainer = document.createElement('div');
  loadingContainer.innerHTML = `
    <div style="color: #aaa; font-size: 12px; margin-bottom: 8px;">
      Romanizing lyrics using Google Translate...
    </div>
    <div style="line-height: 1.6; white-space: pre-line; font-family: inherit; opacity: 0.5;">
      ${originalText}
    </div>
  `;
  
  lyricsElement.innerHTML = '';
  lyricsElement.appendChild(loadingContainer);
  console.log('Loading state displayed');
  
  try {
    console.log('Sending text to background script for romanization');
    const romanizedText = await romanizeText(originalText);
    console.log('Received romanized text:', romanizedText.substring(0, 100) + '...');
    
    // Cache the romanized text for this URL
    romanizedCache.url = currentUrl;
    romanizedCache.text = romanizedText;
    console.log('Cached romanized text for URL:', currentUrl);
    
    displayRomanizedLyrics(originalText, romanizedText, 'Romanized lyrics • Multi-language support');
    
  } catch (error) {
    console.error('Error romanizing lyrics:', error);
    
    // Show error message
    const errorContainer = document.createElement('div');
    errorContainer.innerHTML = `
      <div style="color: #ff4444; font-size: 12px; margin-bottom: 8px;">
        ❌ Romanization failed - Check internet connection
      </div>
      <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">
        Error: ${error.message}
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
        <div style="color: #aaa; font-size: 12px; margin-bottom: 8px;">
          Original lyrics:
        </div>
        <div style="line-height: 1.6; white-space: pre-line; opacity: 0.7; font-family: inherit;">
          ${originalText}
        </div>
      </div>
    `;
    
    lyricsElement.innerHTML = '';
    lyricsElement.appendChild(errorContainer);
  }
}

// Helper function to display romanized lyrics
function displayRomanizedLyrics(originalText, romanizedText, statusMessage) {
  const romanizedContainer = document.createElement('div');

  romanizedContainer.innerHTML = `
    <div style="color: #aaa; font-size: 12px; margin-bottom: 8px;">
      ${statusMessage}
    </div>
    <div style="line-height: 1.6; white-space: pre-line; font-family: inherit;">
      ${romanizedText}
    </div>
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
      <div style="color: #aaa; font-size: 12px; margin-bottom: 8px;">
        Original lyrics:
      </div>
      <div style="line-height: 1.6; white-space: pre-line; opacity: 0.7; font-family: inherit;">
        ${originalText}
      </div>
    </div>
  `;

  lyricsElement.innerHTML = '';
  lyricsElement.appendChild(romanizedContainer);
}



// Function to show original lyrics
function showOriginalLyrics() {
  if (lyricsElement && originalLyricsContent) {
    lyricsElement.innerHTML = originalLyricsContent;
  }
}

// Wait for the page to load and inject the Romanized lyrics button
function injectRomanizedButton() {
  // Check if button already exists to avoid duplicates
  if (document.querySelector('.lyrics-av-toggle')) {
    return;
  }

  // Look for the lyrics tab - try multiple selectors
  let lyricsTab = null;
  const possibleSelectors = [
    'tp-yt-paper-tab .tab-content:contains("Lyrics")',
    'tp-yt-paper-tab[aria-selected="true"] .tab-content',
    '.tab-header.iron-selected .tab-content'
  ];

  // Find lyrics tab by checking text content
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent && tabContent.textContent.trim().includes('Lyrics')) {
      lyricsTab = tab;
      break;
    }
  }
  
  if (!lyricsTab) {
    // If lyrics tab not found, try again after a short delay
    setTimeout(injectRomanizedButton, 1000);
    return;
  }

  // Find the tabs container - look for the parent that contains all tabs
  let tabsContainer = lyricsTab.parentElement;
  
  // Try to find a better container if the immediate parent doesn't seem right
  if (tabsContainer && !tabsContainer.classList.contains('tabs')) {
    const possibleContainer = lyricsTab.closest('tp-yt-paper-tabs, .tabs-container, [role="tablist"]');
    if (possibleContainer) {
      tabsContainer = possibleContainer;
    }
  }
  
  if (!tabsContainer) {
    setTimeout(injectRomanizedButton, 1000);
    return;
  }

  // Create the romanize button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'lyrics-av-toggle style-scope ytmusic-av-toggle';

  // Create the Romanized lyrics button
  const romanizedButton = document.createElement('button');
  romanizedButton.id = 'romanized-lyrics-btn';
  romanizedButton.className = 'romanize-button style-scope ytmusic-av-toggle';
  romanizedButton.setAttribute('aria-pressed', 'false');
  romanizedButton.textContent = 'Romanize';
  
  // Add button to container
  buttonContainer.appendChild(romanizedButton);

  // Add click event listener for romanization functionality
  romanizedButton.addEventListener('click', function() {
    console.log('Romanized button clicked!');
    const isPressed = romanizedButton.getAttribute('aria-pressed') === 'true';
    romanizedButton.setAttribute('aria-pressed', !isPressed);
    
    if (!isPressed) {
      console.log('Romanized lyrics activated');
      showRomanizedLyrics();
    } else {
      console.log('Romanized lyrics deactivated');
      showOriginalLyrics();
    }
  });

  // Try different insertion strategies
  if (tabsContainer.tagName === 'TP-YT-PAPER-TABS') {
    // If it's the actual tabs container, append as a sibling element
    tabsContainer.parentElement.insertBefore(buttonContainer, tabsContainer.nextSibling);
  } else {
    // Otherwise, insert after the lyrics tab
    tabsContainer.insertBefore(buttonContainer, lyricsTab.nextSibling);
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectRomanizedButton);
} else {
  injectRomanizedButton();
}

// Function to reset all state when song changes
function resetExtensionState() {
  console.log('Resetting extension state for new song');
  
  // If we have a lyrics element that was modified, try to restore it
  if (lyricsElement && originalLyricsContent) {
    console.log('Restoring original lyrics content before reset');
    try {
      lyricsElement.innerHTML = originalLyricsContent;
    } catch (error) {
      console.log('Could not restore lyrics content:', error);
    }
  }
  
  // Clear cached romanized text
  romanizedCache.url = null;
  romanizedCache.text = null;
  
  // Clear stored lyrics references
  originalLyricsContent = null;
  originalLyricsText = null;
  lyricsElement = null;
  
  // Reset any existing button states
  const existingRomanizedButton = document.querySelector('#romanized-lyrics-btn');
  if (existingRomanizedButton) {
    existingRomanizedButton.setAttribute('aria-pressed', 'false');
    existingRomanizedButton.textContent = 'Romanize';
  }
  
  // Force a refresh of the lyrics area to ensure new content is visible
  setTimeout(() => {
    const lyricsSelector = 'yt-formatted-string.non-expandable.description.style-scope.ytmusic-description-shelf-renderer';
    const currentLyricsElement = document.querySelector(lyricsSelector);
    if (currentLyricsElement) {
      console.log('Found new song lyrics element, ensuring it\'s visible');
      // Trigger a refresh by temporarily hiding and showing
      const originalDisplay = currentLyricsElement.style.display;
      currentLyricsElement.style.display = 'none';
      setTimeout(() => {
        currentLyricsElement.style.display = originalDisplay;
      }, 10);
    }
  }, 1000);
}

// Also run when navigating to new songs (YouTube Music is a SPA)
let currentUrl = location.href;
setInterval(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('URL changed to:', currentUrl);
    
    // Check if we have cached data (meaning the button was used)
    const hadCachedData = romanizedCache.url !== null && romanizedCache.text !== null;
    
    // Reset all extension state for the new song
    resetExtensionState();
    
    // Only refresh if the extension was used (had cached romanized text)
    if (hadCachedData) {
      console.log('Extension was used on previous song, refreshing page for clean state...');
      window.location.reload();
    } else {
      console.log('Extension was not used on previous song, no refresh needed');
      setTimeout(injectRomanizedButton, 2000); // Delay to allow page to load
    }
  }
}, 1000);

// Watch for changes in the DOM (in case the lyrics section loads dynamically)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // Check if lyrics-related elements were added
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.querySelector && (
            node.querySelector('tp-yt-paper-tab') || 
            node.classList && node.classList.contains('tab-header')
          )) {
            setTimeout(injectRomanizedButton, 500);
          }
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});