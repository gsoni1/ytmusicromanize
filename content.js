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


// Function to find and store lyrics with tab switching workaround
async function findAndStoreLyrics() {
  const lyricsSelector = 'yt-formatted-string.non-expandable.description.style-scope.ytmusic-description-shelf-renderer';
  
  console.log('=== DEBUG: findAndStoreLyrics called ===');
  console.log('Current URL:', window.location.href);
  console.log('Looking for lyrics with selector:', lyricsSelector);
  
  // First, ensure we're on the lyrics tab
  const lyricsTab = await ensureLyricsTabActive();
  if (!lyricsTab) {
    console.log('❌ Could not find or activate lyrics tab');
    return false;
  }
  
  // First, check if YouTube Music is showing "Lyrics not available" message
  const noLyricsMessage = document.querySelector('yt-formatted-string.text.style-scope.ytmusic-message-renderer');
  if (noLyricsMessage && noLyricsMessage.textContent.includes('Lyrics not available')) {
    console.log('❌ YouTube Music shows "Lyrics not available" message');
    return false;
  }
  
  // Check if element exists in DOM
  lyricsElement = document.querySelector(lyricsSelector);
  console.log('Found lyrics element:', lyricsElement);
  
  // Additional debugging - check for similar elements
  const allDescriptionElements = document.querySelectorAll('yt-formatted-string');
  console.log('Total yt-formatted-string elements found:', allDescriptionElements.length);
  
  const descriptionShelfElements = document.querySelectorAll('ytmusic-description-shelf-renderer');
  console.log('Description shelf renderers found:', descriptionShelfElements.length);
  
  if (lyricsElement) {
    console.log('Lyrics element details:');
    console.log('- Tag name:', lyricsElement.tagName);
    console.log('- Class list:', lyricsElement.classList.toString());
    console.log('- Parent element:', lyricsElement.parentElement);
    console.log('- Text content length:', lyricsElement.textContent.length);
    console.log('- HTML content length:', lyricsElement.innerHTML.length);
    console.log('- Has is-empty attribute:', lyricsElement.hasAttribute('is-empty'));
    
    // Check if lyrics element is loaded and has content
    const hasContent = lyricsElement.textContent.trim().length > 0;
    const isNotEmpty = !lyricsElement.hasAttribute('is-empty');
    const isLoaded = hasContent && isNotEmpty;
    
    if (!isLoaded) {
      console.log('⚠️ Lyrics element found but empty/loading, trying tab switch workaround...');
      console.log('- Has content:', hasContent);
      console.log('- Not marked as empty:', isNotEmpty);
      
      // Try the tab switching workaround
      const reloadSuccessful = await reloadLyricsWithTabSwitch();
      if (!reloadSuccessful) {
        console.log('❌ Tab switch workaround failed');
        return false;
      }
      
      // Re-check the lyrics element after tab switch
      lyricsElement = document.querySelector(lyricsSelector);
      
      // Also check if "Lyrics not available" message appeared after tab switch
      const noLyricsMessageAfterSwitch = document.querySelector('yt-formatted-string.text.style-scope.ytmusic-message-renderer');
      if (noLyricsMessageAfterSwitch && noLyricsMessageAfterSwitch.textContent.includes('Lyrics not available')) {
        console.log('❌ "Lyrics not available" message shown after tab switch');
        return false;
      }
      
      if (!lyricsElement || lyricsElement.hasAttribute('is-empty') || lyricsElement.textContent.trim().length === 0) {
        console.log('❌ Lyrics still not loaded after tab switch');
        return false;
      }
      
      console.log('✅ Tab switch workaround successful, lyrics now loaded');
    }
    
    console.log('✅ Lyrics element is fully loaded with content');
    
    // Only cache original content if we haven't already (to preserve the true original)
    if (originalLyricsContent === null) {
      originalLyricsContent = lyricsElement.innerHTML;
      originalLyricsText = lyricsElement.textContent;
      console.log('✅ Cached original lyrics content and text');
      console.log('Original content length:', originalLyricsContent.length);
      console.log('Original text length:', originalLyricsText.length);
    } else {
      console.log('⚠️ Original lyrics already cached, not overwriting');
      console.log('Existing cached content length:', originalLyricsContent ? originalLyricsContent.length : 'null');
      
      // Check if the current lyrics match what we have cached
      if (lyricsElement.textContent !== originalLyricsText) {
        console.log('🔄 Current lyrics differ from cached - this might be a new song');
        console.log('Current text preview:', lyricsElement.textContent.substring(0, 100) + '...');
        console.log('Cached text preview:', originalLyricsText.substring(0, 100) + '...');
        
        // For new songs, we should clear cache and re-cache
        originalLyricsContent = lyricsElement.innerHTML;
        originalLyricsText = lyricsElement.textContent;
        console.log('🔄 Re-cached new song lyrics');
      }
    }
    
    console.log('Lyrics content preview:', lyricsElement.textContent.substring(0, 100) + '...');
    return true;
  }
  
  console.log('❌ No lyrics found with main selector');
  return false;
}

// Helper function to ensure lyrics tab is active
async function ensureLyricsTabActive() {
  console.log('=== Ensuring lyrics tab is active ===');
  
  // Look for the lyrics tab
  let lyricsTab = null;
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  console.log('Found', allTabs.length, 'tabs total');
  
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent) {
      const tabText = tabContent.textContent.trim();
      console.log('Tab text:', tabText, 'aria-selected:', tab.getAttribute('aria-selected'));
      if (tabText.includes('Lyrics')) {
        lyricsTab = tab;
        console.log('✅ Found lyrics tab');
        break;
      }
    }
  }
  
  if (!lyricsTab) {
    console.log('❌ Lyrics tab not found');
    return null;
  }
  
  // Check if we're already on the lyrics tab using aria-selected
  if (lyricsTab.getAttribute('aria-selected') === 'true') {
    console.log('✅ Already on lyrics tab');
    return lyricsTab;
  }
  
  // Click the lyrics tab
  console.log('📌 Clicking lyrics tab to activate it...');
  lyricsTab.click();
  
  // Wait for tab to become active and verify
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify the tab is now active
  if (lyricsTab.getAttribute('aria-selected') === 'true') {
    console.log('✅ Successfully activated lyrics tab');
  } else {
    console.log('⚠️ Lyrics tab may not have activated properly');
  }
  
  return lyricsTab;
}

// Helper function to reload lyrics by switching tabs
async function reloadLyricsWithTabSwitch() {
  console.log('=== Attempting tab switch workaround to reload lyrics ===');
  
  // Find a non-lyrics tab to switch to temporarily
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  let relatedTab = null;
  let lyricsTab = null;
  
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent) {
      const tabText = tabContent.textContent.trim();
      console.log('Found tab:', tabText, 'aria-selected:', tab.getAttribute('aria-selected'));
      
      if (tabText.includes('Lyrics')) {
        lyricsTab = tab;
      } else if (tabText.includes('Up next') || tabText.includes('Related')) {
        relatedTab = tab;
        console.log('✅ Found non-lyrics tab for switching:', tabText);
      }
    }
  }
  
  if (!relatedTab) {
    console.log('❌ No suitable tab found for switching');
    return false;
  }
  
  if (!lyricsTab) {
    console.log('❌ Lyrics tab not found for switching back');
    return false;
  }
  
  // Verify we're currently on the lyrics tab
  const currentlyActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (currentlyActiveTab) {
    const activeTabText = currentlyActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('Currently active tab before switch:', activeTabText);
  }
  
  // Switch to the related tab
  console.log('🔄 Switching to related tab...');
  relatedTab.click();
  
  // Wait and verify the switch happened
  await new Promise(resolve => setTimeout(resolve, 500));
  const newActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (newActiveTab) {
    const newActiveTabText = newActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('✅ Successfully switched to:', newActiveTabText);
  }
  
  // Switch back to lyrics tab
  console.log('🔄 Switching back to lyrics tab...');
  lyricsTab.click();
  
  // Wait and verify we're back on lyrics
  await new Promise(resolve => setTimeout(resolve, 500));
  const finalActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (finalActiveTab) {
    const finalActiveTabText = finalActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('✅ Successfully switched back to:', finalActiveTabText);
  }
  
  // Wait for lyrics to load after switching back
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log('✅ Tab switch workaround completed');
  return true;
}

// Function to show romanized lyrics
async function showRomanizedLyrics() {
  console.log('showRomanizedLyrics called');
  
  const lyricsFound = await findAndStoreLyrics();
  if (!lyricsFound) {
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
    console.log('Reverted to original lyrics');
  }
}

// Emergency function to ensure lyrics are restored
function ensureLyricsRestored() {
  if (lyricsElement && originalLyricsContent) {
    try {
      lyricsElement.innerHTML = originalLyricsContent;
      console.log('Emergency lyrics restoration successful');
      return true;
    } catch (error) {
      console.log('Emergency lyrics restoration failed:', error);
      return false;
    }
  }
  return false;
}

// Function to check if the romanize button should be shown
async function shouldShowRomanizeButton() {
  console.log('=== DEBUG: shouldShowRomanizeButton called ===');
  
  // First, try to find and cache lyrics if not already done
  const lyricsFound = await findAndStoreLyrics();
  console.log('findAndStoreLyrics result:', lyricsFound);
  
  if (!lyricsFound) {
    console.log('❌ No lyrics found, hiding romanize button');
    return false;
  }

  // Check if lyrics contain non-Latin text that needs romanization
  const lyricsText = originalLyricsText || (lyricsElement ? lyricsElement.textContent : '');
  console.log('Lyrics text source:', originalLyricsText ? 'originalLyricsText' : 'lyricsElement.textContent');
  console.log('Lyrics text length:', lyricsText.length);
  console.log('Lyrics text preview (first 100 chars):', lyricsText.substring(0, 100));
  
  const nonLatinText = extractNonLatinText(lyricsText);
  console.log('extractNonLatinText result:', nonLatinText);
  
  if (!nonLatinText) {
    console.log('⚠️ Lyrics are already in English characters, hiding romanize button');
    return false;
  }

  console.log('✅ Non-Latin text found, showing romanize button');
  console.log('Non-Latin text preview:', nonLatinText.substring(0, 50));
  return true;
}

// Wait for the page to load and inject the Romanized lyrics button
async function injectRomanizedButton() {
  console.log('=== DEBUG: injectRomanizedButton called ===');
  console.log('Current URL:', window.location.href);
  
  // Check if button already exists to avoid duplicates
  const existingButton = document.querySelector('#romanized-lyrics-btn');
  if (existingButton) {
    console.log('⚠️ Button already exists, skipping injection');
    return;
  }

  // Check if lyrics are available and need romanization
  const shouldShow = await shouldShowRomanizeButton();
  console.log('shouldShowRomanizeButton result:', shouldShow);
  
  if (!shouldShow) {
    console.log('⚠️ Romanize button not needed - lyrics are already in English or not found');
    return;
  }

  // Find the lyrics tab to get the tab-content div
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  let lyricsTab = null;
  
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent && tabContent.textContent.trim().includes('Lyrics')) {
      lyricsTab = tab;
      break;
    }
  }
  
  if (!lyricsTab) {
    console.log('❌ Lyrics tab not found for button injection');
    return;
  }

  const tabContentDiv = lyricsTab.querySelector('.tab-content');
  if (!tabContentDiv) {
    console.log('❌ Tab content div not found for button injection');
    return;
  }

  // Create the Romanized lyrics button
  const romanizedButton = document.createElement('button');
  romanizedButton.id = 'romanized-lyrics-btn';
  romanizedButton.className = 'romanize-tab-button style-scope tp-yt-paper-tab';
  romanizedButton.setAttribute('aria-pressed', 'false');
  romanizedButton.textContent = 'Romanize';

  // Add click event listener for romanization functionality
  romanizedButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent tab switching when clicking the button
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

  // Insert the button into the tab-content div below the "Lyrics" text
  tabContentDiv.appendChild(romanizedButton);
  console.log('✅ Romanize button injected successfully');
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectRomanizedButton());
} else {
  injectRomanizedButton();
}

// Function to reset all state when song changes
function resetExtensionState() {
  console.log('=== DEBUG: resetExtensionState called ===');
  console.log('Current state:');
  console.log('- lyricsElement exists:', !!lyricsElement);
  console.log('- originalLyricsContent exists:', !!originalLyricsContent);
  console.log('- originalLyricsText exists:', !!originalLyricsText);
  console.log('- romanizedCache.url:', romanizedCache.url);
  console.log('- romanizedCache.text exists:', !!romanizedCache.text);
  
  // If we have a lyrics element that was modified, restore it immediately
  if (lyricsElement && originalLyricsContent) {
    console.log('🔄 Attempting to restore original lyrics content...');
    console.log('Lyrics element still in DOM:', document.contains(lyricsElement));
    console.log('Original content length:', originalLyricsContent.length);
    
    try {
      lyricsElement.innerHTML = originalLyricsContent;
      console.log('✅ Successfully restored original lyrics');
      
      // Verify restoration
      const currentContent = lyricsElement.innerHTML;
      console.log('Verification - current content length:', currentContent.length);
      console.log('Content matches original:', currentContent === originalLyricsContent);
      
    } catch (error) {
      console.log('❌ Could not restore lyrics content:', error);
    }
  } else {
    console.log('⚠️ No lyrics to restore (lyricsElement:', !!lyricsElement, ', originalLyricsContent:', !!originalLyricsContent, ')');
  }
  
  // Clear cached romanized text
  romanizedCache.url = null;
  romanizedCache.text = null;
  console.log('🧹 Cleared romanized cache');
  
  // Clear stored lyrics references
  originalLyricsContent = null;
  originalLyricsText = null;
  lyricsElement = null;
  console.log('🧹 Cleared lyrics references');
  
  // Remove any existing button since we'll re-evaluate if it's needed
  const existingRomanizedButton = document.querySelector('#romanized-lyrics-btn');
  if (existingRomanizedButton) {
    existingRomanizedButton.remove();
    console.log('🧹 Removed existing romanize button for new song');
  } else {
    console.log('ℹ️ No existing romanize button to remove');
  }
}

// Also run when navigating to new songs (YouTube Music is a SPA)
let currentUrl = location.href;

// Use both setInterval and navigation event listeners for better coverage
setInterval(() => {
  if (location.href !== currentUrl) {
    handleUrlChange();
  }
}, 1000);

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', handleUrlChange);

// Emergency restoration before page unload
window.addEventListener('beforeunload', () => {
  console.log('Page unloading, attempting emergency lyrics restoration');
  ensureLyricsRestored();
});

function handleUrlChange() {
  const newUrl = location.href;
  if (newUrl !== currentUrl) {
    console.log('=== DEBUG: URL CHANGE DETECTED ===');
    console.log('Old URL:', currentUrl);
    console.log('New URL:', newUrl);
    
    currentUrl = newUrl;
    
    // Check if we have cached data (meaning the button was used)
    const hadCachedData = romanizedCache.url !== null && romanizedCache.text !== null;
    const hadModifiedLyrics = lyricsElement && originalLyricsContent;
    
    console.log('Pre-reset state check:');
    console.log('- hadCachedData:', hadCachedData);
    console.log('- hadModifiedLyrics:', hadModifiedLyrics);
    console.log('- romanizedCache.url:', romanizedCache.url);
    
    // Reset all extension state for the new song
    resetExtensionState();
    
    // No need to refresh - state restoration is working perfectly
    console.log('✅ Extension state reset complete, proceeding without refresh');
    console.log('Scheduling button injection in 5 seconds to allow new lyrics to load...');
    setTimeout(() => {
      console.log('⏰ Timeout reached, calling injectRomanizedButton...');
      injectRomanizedButton();
    }, 5000); // Longer delay to allow new lyrics to fully load
  }
}

// Watch for changes in the DOM (in case the lyrics tab loads dynamically)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // Check if lyrics tab elements were added
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.querySelector && (
            node.querySelector('tp-yt-paper-tab') || 
            node.classList && node.classList.contains('tab-header') ||
            node.querySelector('.tab-content')
          )) {
            setTimeout(() => injectRomanizedButton(), 500);
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