// Background script for handling Google Translate automation

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'romanizeText') {
    romanizeWithGoogleTranslate(request.text)
      .then(result => sendResponse({ success: true, romanizedText: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});


async function romanizeWithGoogleTranslate(text) {
  let tab = null;
  let originalActiveTab = null;
  try {
    console.log('Background: Starting romanization for text:', text.substring(0, 50));

    // Get the currently active tab so we can switch back to it
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    originalActiveTab = activeTab;
    console.log('Background: Original active tab:', originalActiveTab?.id);

    // Create a new tab with Google Translate for romanization
    tab = await chrome.tabs.create({
      url: 'https://translate.google.com/?sl=auto&tl=en&op=translate',
      active: true // Make it active initially so it loads properly
    });
    
    console.log('Background: Created tab with ID:', tab.id);
    
    // Wait for the tab to load
    await waitForTabLoad(tab.id);
    console.log('Background: Tab loaded');
    
    console.log('Background: Injecting romanization script');

    // Inject script to handle the romanization (keep tab active during this process)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: performRomanization,
      args: [text]
    });

    console.log('Background: Script execution results:', results);

    let romanizedText = null;
    
    if (results && results[0]) {
      if (results[0].result) {
        console.log('Background: Successfully got romanized text:', results[0].result.substring(0, 100));
        romanizedText = results[0].result;
      } else if (results[0].error) {
        throw new Error(`Injected script error: ${results[0].error}`);
      }
    }
    
    if (!romanizedText) {
      throw new Error('Failed to get romanized text from Google Translate - no valid result');
    }
    
    // Now that we have the result, switch back to the original tab
    if (originalActiveTab && originalActiveTab.id) {
      console.log('Background: Translation complete, switching back to original tab:', originalActiveTab.id);
      try {
        await chrome.tabs.update(originalActiveTab.id, { active: true });
      } catch (switchError) {
        console.log('Background: Could not switch back to original tab (may have been closed):', switchError.message);
      }
    }
    
    return romanizedText;
    
  } catch (error) {
    console.error('Background: Error in romanization:', error);
    throw error;
  } finally {
    // Always close the tab, even if there's an error
    if (tab && tab.id) {
      try {
        await chrome.tabs.remove(tab.id);
        console.log('Background: Tab closed');
      } catch (closeError) {
        console.error('Background: Error closing tab:', closeError);
      }
    }
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab loading timeout'));
    }, 10000); // 10 second timeout
    
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        console.log('Background: Tab finished loading');
        // No delay - resolve immediately
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// This function will be injected into the Google Translate page for romanization
function performRomanization(text) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Injected script: Starting romanization process');
      console.log('Injected script: Looking for elements on page...');

      // Wait for elements with minimal timeout
      const waitForElement = (selectors, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

          const checkElement = () => {
            for (const selector of selectorArray) {
              const element = document.querySelector(selector);
              if (element) {
                console.log('Injected script: Found element with selector:', selector);
                resolve(element);
                return;
              }
            }

            if (Date.now() - startTime > timeout) {
              console.log('Injected script: Available elements:', document.querySelectorAll('textarea, input[type="text"]'));
              reject(new Error(`None of the selectors found within ${timeout}ms: ${selectorArray.join(', ')}`));
            } else {
              setTimeout(checkElement, 50); // Faster checking
            }
          };
          checkElement();
        });
      };

      // Try multiple selectors for the source textarea
      const textareaSelectors = [
        'textarea[aria-label="Source text"]',
        'textarea[placeholder="Enter text"]',
        'textarea.er8xn',
        'textarea[jsname="BJE2fc"]',
        'textarea[data-initial-value=""]',
        'textarea:first-of-type'
      ];

      // Wait for the textarea to be available
      waitForElement(textareaSelectors)
        .then(textarea => {
          console.log('Injected script: Found textarea, inserting text');
          console.log('Injected script: Textarea element:', textarea);

          // Clear any existing text and insert new text
          textarea.value = '';
          textarea.focus();

          // Use different methods to set the text
          textarea.value = text;
          textarea.innerHTML = text;
          textarea.textContent = text;

          // Try multiple input events
          textarea.dispatchEvent(new Event('focus', { bubbles: true }));
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.dispatchEvent(new Event('keyup', { bubbles: true }));
          textarea.dispatchEvent(new Event('paste', { bubbles: true }));

          console.log('Injected script: Text inserted, waiting for romanization...');

          // For romanization, we need to look for the specific romanization element
          const romanizationSelectors = [
            'span[jsname="toZopb"]', // Primary romanization element
            '[data-romanization] span',
            '.romanization span',
            '.transliteration span',
            'span[lang="en-t-i0-pinyin"]',
            'span[lang="en-Latn"]',
            '.source-romanization'
          ];

          // Wait for the romanization/translation result
          return waitForElement(romanizationSelectors, 8000);
        })
        .then(resultSpan => {
          console.log('Injected script: Found result span');
          console.log('Injected script: Result element:', resultSpan);

          // Extract immediately - no delay
          const romanizedText = resultSpan.textContent || resultSpan.innerText;
          console.log('Injected script: Extracted romanized text:', romanizedText.substring(0, 100));

          if (romanizedText && romanizedText.trim() && romanizedText.trim() !== text.trim()) {
            resolve(romanizedText);
          } else {
            // Try to find any translated/romanized text in the page
            const allSpans = document.querySelectorAll('span');
            let foundTranslation = null;

            for (const span of allSpans) {
              const spanText = span.textContent || span.innerText;
              if (spanText && spanText.length > 10 && spanText !== text && /[a-zA-Z]/.test(spanText)) {
                console.log('Injected script: Found potential romanization:', spanText.substring(0, 50));
                foundTranslation = spanText;
                break;
              }
            }

            if (foundTranslation) {
              resolve(foundTranslation);
            } else {
              reject(new Error('No valid romanized text found or text unchanged'));
            }
          }
        })
        .catch(error => {
          console.error('Injected script: Error in romanization process:', error);
          console.log('Injected script: Page HTML for debugging:', document.documentElement.outerHTML.substring(0, 1000));
          reject(error);
        });

    } catch (error) {
      console.error('Injected script: Unexpected error:', error);
      reject(error);
    }
  });
}

