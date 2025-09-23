// Store original lyrics for toggling
let originalLyricsContent = null;
let originalLyricsText = null; // Cache the original text content
let lyricsElement = null;

// Flag to track if we need to perform tab switch when user goes to lyrics tab
let needsTabSwitchOnLyricsEntry = false;

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

// Helper function to perform universal tab switch (from any tab to related and back)
async function performUniversalTabSwitch(originalTabText) {
  console.log('=== Attempting universal tab switch workaround ===');
  console.log('Original tab:', originalTabText);
  
  // Find all available tabs
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  let originalTab = null;
  let availableTabs = [];
  
  // First pass: catalog all tabs
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent) {
      const tabText = tabContent.textContent.trim();
      const normalizedTabText = tabText.replace(/\s+/g, ' ').trim(); // Normalize whitespace
      console.log('Found tab:', `"${tabText}"`, 'normalized:', `"${normalizedTabText}"`, 'aria-selected:', tab.getAttribute('aria-selected'));
      
      availableTabs.push({
        element: tab,
        text: normalizedTabText,
        isOriginal: normalizedTabText === originalTabText || tabText === originalTabText
      });
      
      // Find the original tab
      if (normalizedTabText === originalTabText || tabText === originalTabText) {
        originalTab = tab;
        console.log('📍 Found original tab:', normalizedTabText);
      }
    }
  }
  
  // Second pass: select tab to switch to (only Lyrics <-> Related switching)
  let switchToTab = null;
  
  if (originalTabText.includes('Lyrics')) {
    // If user is on Lyrics tab, switch to Related tab
    for (const tabInfo of availableTabs) {
      if (tabInfo.text.includes('Related')) {
        switchToTab = tabInfo.element;
        console.log('✅ User on Lyrics tab, will switch to Related tab');
        break;
      }
    }
  } else if (originalTabText.includes('Related')) {
    // If user is on Related tab, switch to Lyrics tab  
    for (const tabInfo of availableTabs) {
      if (tabInfo.text.includes('Lyrics')) {
        switchToTab = tabInfo.element;
        console.log('✅ User on Related tab, will switch to Lyrics tab');
        break;
      }
    }
  } else {
    // If user is on any other tab (like Up next), don't do tab switching
    console.log('⚠️ User is on', originalTabText, 'tab - skipping tab switch (only works for Lyrics/Related)');
    return false;
  }
  
  if (!switchToTab) {
    console.log('❌ No suitable tab found for switching');
    return false;
  }
  
  if (!originalTab) {
    console.log('⚠️ Original tab not found, will switch back to first available tab');
    originalTab = allTabs[0];
  }
  
  // Verify current state
  const currentlyActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (currentlyActiveTab) {
    const activeTabText = currentlyActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('Currently active tab before switch:', activeTabText);
  }
  
  // Switch to the alternative tab
  const switchToTabText = switchToTab.querySelector('.tab-content')?.textContent.trim();
  const normalizedSwitchText = switchToTabText.replace(/\s+/g, ' ').trim();
  console.log('🔄 Switching to tab:', `"${switchToTabText}"`, 'normalized:', `"${normalizedSwitchText}"`);
  console.log('🔄 About to click tab element:', switchToTab);
  switchToTab.click();
  
  // Wait and verify the switch happened
  await new Promise(resolve => setTimeout(resolve, 500));
  const newActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (newActiveTab) {
    const newActiveTabText = newActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('✅ Successfully switched to:', newActiveTabText);
  }
  
  // Wait on the other tab
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Switch back to original tab
  console.log('🔄 Switching back to original tab:', originalTabText);
  originalTab.click();
  
  // Wait and verify we're back
  await new Promise(resolve => setTimeout(resolve, 500));
  const finalActiveTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
  if (finalActiveTab) {
    const finalActiveTabText = finalActiveTab.querySelector('.tab-content')?.textContent.trim();
    console.log('✅ Successfully switched back to:', finalActiveTabText);
    
    // Verify we're actually on the correct tab
    if (!finalActiveTabText.includes(originalTabText)) {
      console.log('⚠️ Tab switch verification failed - expected:', originalTabText, 'got:', finalActiveTabText);
      // Try clicking the original tab again
      console.log('🔄 Attempting to correct tab selection...');
      originalTab.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Wait longer for content to load and stabilize
  console.log('⏳ Waiting for content to load and stabilize...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Additional verification - check what content is actually showing
  const currentContent = document.querySelector('yt-formatted-string.non-expandable.description.style-scope.ytmusic-description-shelf-renderer');
  if (currentContent) {
    const contentPreview = currentContent.textContent.substring(0, 100);
    console.log('📄 Current content preview:', contentPreview);
  } else {
    console.log('📄 No lyrics content found after tab switch');
  }
  
  // Final verification and potential fix
  if (originalTabText.includes('Lyrics')) {
    console.log('🔍 Verifying lyrics tab is showing correct content...');
    
    // Check if we're still showing related content on lyrics tab
    const pageType = document.querySelector('ytmusic-description-shelf-renderer')?.getAttribute('page-type');
    console.log('📋 Page type attribute:', pageType);
    
    // If we detect we're showing wrong content, try one more refresh
    if (!pageType || !pageType.includes('LYRICS')) {
      console.log('⚠️ Detected incorrect content on lyrics tab, attempting refresh...');
      
      // Try switching to Related and back one more time with longer delays
      const relatedTab = Array.from(document.querySelectorAll('tp-yt-paper-tab')).find(tab => 
                          tab.querySelector('.tab-content')?.textContent.trim().includes('Related'));
      
      if (relatedTab) {
        console.log('🔄 Emergency refresh: switching to Related...');
        relatedTab.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🔄 Emergency refresh: switching back to Lyrics...');
        originalTab.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
  
  console.log('✅ Universal tab switch workaround completed');
  return true;
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
  
  // Always try to find lyrics, but don't let it block the functionality
  const lyricsFound = await findAndStoreLyrics();
  
  if (!lyricsFound) {
    console.log('No lyrics available for romanization, showing helpful message');
    
    // Show a message in any available content area
    const possibleContainers = [
      document.querySelector('ytmusic-description-shelf-renderer'),
      document.querySelector('[role="tabpanel"]'),
      document.querySelector('.tab-content-wrapper'),
      document.querySelector('#main-panel'),
      document.querySelector('.ytmusic-player-page')
    ];
    
    const lyricsContainer = possibleContainers.find(container => container !== null);
    
    if (lyricsContainer) {
      const messageContainer = document.createElement('div');
      messageContainer.id = 'romanize-no-lyrics-message';
      messageContainer.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #aaa;
        background: rgba(0,0,0,0.1);
        border-radius: 8px;
        margin: 10px;
        border: 1px solid rgba(255,255,255,0.1);
      `;
      messageContainer.innerHTML = `
        <div style="font-size: 16px; margin-bottom: 8px;">
          📝 Romanize Button Active
        </div>
        <div style="font-size: 14px; opacity: 0.8;">
          No lyrics available to romanize for this song
        </div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.6;">
          Try switching to a song with lyrics to use romanization
        </div>
      `;
      
      // Try to find and replace lyrics content area, or append to container
      const lyricsArea = lyricsContainer.querySelector('yt-formatted-string') || 
                        lyricsContainer.querySelector('.description') ||
                        lyricsContainer;
      
      // Remove any existing message first
      const existingMessage = document.querySelector('#romanize-no-lyrics-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      if (lyricsArea && lyricsArea !== lyricsContainer) {
        lyricsArea.innerHTML = '';
        lyricsArea.appendChild(messageContainer);
      } else {
        lyricsContainer.appendChild(messageContainer);
      }
    } else {
      console.log('Could not find suitable container for no-lyrics message');
    }
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
    displayRomanizedLyrics(originalText, romanizedCache.text, 'Pronunciation lyrics • Cached');
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
    
    displayRomanizedLyrics(originalText, romanizedText, 'Pronunciation lyrics • Multi-language support');
    
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
  
  // Force show the romanize button at all times
  console.log('✅ Forcing romanize button to show at all times');
  
  // Still try to find and cache lyrics for functionality, but don't let it block the button
  const lyricsFound = await findAndStoreLyrics();
  console.log('findAndStoreLyrics result:', lyricsFound);
  
  if (lyricsFound) {
    const lyricsText = originalLyricsText || (lyricsElement ? lyricsElement.textContent : '');
    console.log('Lyrics text source:', originalLyricsText ? 'originalLyricsText' : 'lyricsElement.textContent');
    console.log('Lyrics text length:', lyricsText.length);
    console.log('Lyrics text preview (first 100 chars):', lyricsText.substring(0, 100));
    
    const nonLatinText = extractNonLatinText(lyricsText);
    console.log('extractNonLatinText result:', nonLatinText);
    
    if (nonLatinText) {
      console.log('✅ Non-Latin text found for romanization');
      console.log('Non-Latin text preview:', nonLatinText.substring(0, 50));
    } else {
      console.log('ℹ️ Lyrics are in English characters, but button will still show');
    }
  } else {
    console.log('ℹ️ No lyrics found, but button will still show');
  }

  return true; // Always return true to force button to show
}

// Wait for the page to load and inject the Romanized lyrics button
async function injectRomanizedButton() {
  console.log('=== DEBUG: injectRomanizedButton called ===');
  console.log('Current URL:', window.location.href);
  
  // Check if button already exists to avoid duplicates - check multiple ways
  const existingButton = document.querySelector('#romanized-lyrics-btn');
  const existingButtonByClass = document.querySelector('.romanize-tab-button');
  
  if (existingButton || existingButtonByClass) {
    console.log('⚠️ Button already exists, skipping injection');
    return;
  }
  
  // Add a temporary flag to prevent race conditions
  if (window.romanizeButtonInjecting) {
    console.log('⚠️ Button injection already in progress, skipping');
    return;
  }
  
  window.romanizeButtonInjecting = true;

  // Always show the romanize button, no matter what
  console.log('✅ Always showing romanize button regardless of conditions');

  // Find the lyrics tab to inject the button, but fallback to any tab if needed
  const allTabs = document.querySelectorAll('tp-yt-paper-tab');
  let targetTab = null;
  
  // First try to find the lyrics tab
  for (const tab of allTabs) {
    const tabContent = tab.querySelector('.tab-content');
    if (tabContent && tabContent.textContent.trim().includes('Lyrics')) {
      targetTab = tab;
      console.log('✅ Found lyrics tab for button injection');
      break;
    }
  }
  
  // If no lyrics tab, use any available tab
  if (!targetTab && allTabs.length > 0) {
    targetTab = allTabs[0];
    console.log('⚠️ No lyrics tab found, using first available tab:', targetTab.textContent.trim());
  }
  
  if (!targetTab) {
    console.log('❌ No tabs found at all for button injection, retrying in 1 second...');
    window.romanizeButtonInjecting = false;
    setTimeout(() => injectRomanizedButton(), 1000);
    return;
  }

  const tabContentDiv = targetTab.querySelector('.tab-content');
  if (!tabContentDiv) {
    console.log('❌ Tab content div not found, retrying in 1 second...');
    window.romanizeButtonInjecting = false;
    setTimeout(() => injectRomanizedButton(), 1000);
    return;
  }

  // Create the Romanized lyrics button
  const romanizedButton = document.createElement('button');
  romanizedButton.id = 'romanized-lyrics-btn';
  romanizedButton.className = 'romanize-tab-button style-scope tp-yt-paper-tab';
  romanizedButton.setAttribute('aria-pressed', 'false');
  romanizedButton.textContent = 'Pronunciation';

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
  
  // Verify the button is actually in the DOM
  setTimeout(() => {
    const verifyButton = document.querySelector('#romanized-lyrics-btn');
    if (verifyButton) {
      console.log('✅ Button verification: Button is present in DOM');
      console.log('Button element:', verifyButton);
      console.log('Button parent:', verifyButton.parentElement);
      console.log('Button visible:', verifyButton.offsetWidth > 0 && verifyButton.offsetHeight > 0);
    } else {
      console.log('❌ Button verification: Button NOT found in DOM after injection');
    }
  }, 100);
  
  // Clear the injection flag
  window.romanizeButtonInjecting = false;
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
  
  // Clear any injection flags
  window.romanizeButtonInjecting = false;
  
  // Clear deferred tab switch flag
  needsTabSwitchOnLyricsEntry = false;
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
    
    // Check current tab and decide on tab switching strategy
    const activeTab = document.querySelector('tp-yt-paper-tab[aria-selected="true"]');
    const rawTabText = activeTab ? activeTab.querySelector('.tab-content')?.textContent.trim() : 'Unknown';
    const originalTabText = rawTabText.replace(/\s+/g, ' ').trim(); // Normalize whitespace
    console.log('📍 Original tab text (raw):', `"${rawTabText}"`);
    console.log('📍 Original tab text (normalized):', `"${originalTabText}"`);
    
    if (originalTabText.includes('Lyrics')) {
      console.log('✅ User is on Lyrics tab, performing immediate tab switch workaround');
      
      setTimeout(async () => {
        console.log('🔄 Performing tab switch workaround for lyrics tab...');
        
        const tabSwitchSuccess = await performUniversalTabSwitch(originalTabText);
        if (tabSwitchSuccess) {
          console.log('⚡ Tab switch successful, injecting button immediately...');
          injectRomanizedButton();
        } else {
          console.log('⚠️ Tab switch failed, using fallback injection...');
          setTimeout(() => {
            console.log('⏰ Fallback injection for lyrics tab...');
            injectRomanizedButton();
          }, 2000);
        }
      }, 300); // Small delay to let URL change settle
    } else {
      console.log('ℹ️ User not on Lyrics tab, setting flag for deferred tab switch');
      console.log('🔖 Will perform tab switch when user navigates to Lyrics tab');
      
      // Set flag to perform tab switch later when user goes to lyrics tab
      needsTabSwitchOnLyricsEntry = true;
      
      // Use standard delay for non-lyrics tabs
      setTimeout(() => {
        console.log('⏰ Standard injection for', originalTabText, 'tab...');
        injectRomanizedButton();
      }, 5000);
    }
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
    
    // Check for tab switching (aria-selected attribute changes)
    if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
      const targetTab = mutation.target;
      if (targetTab.tagName === 'TP-YT-PAPER-TAB' && targetTab.getAttribute('aria-selected') === 'true') {
        const tabContent = targetTab.querySelector('.tab-content');
        if (tabContent) {
          const tabText = tabContent.textContent.trim().replace(/\s+/g, ' ').trim();
          console.log('🔄 Tab switch detected to:', tabText);
          
          // Check if user switched to Lyrics tab and we need to perform deferred tab switch
          if (tabText.includes('Lyrics') && needsTabSwitchOnLyricsEntry) {
            console.log('🔖 Performing deferred tab switch for new song on lyrics entry...');
            needsTabSwitchOnLyricsEntry = false; // Clear the flag
            
            setTimeout(async () => {
              console.log('🔄 Executing deferred tab switch workaround...');
              const tabSwitchSuccess = await performUniversalTabSwitch(tabText);
              if (tabSwitchSuccess) {
                console.log('⚡ Deferred tab switch successful!');
              } else {
                console.log('⚠️ Deferred tab switch failed');
              }
            }, 500); // Small delay to let tab switch settle
          }
        }
      }
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['aria-selected']
});