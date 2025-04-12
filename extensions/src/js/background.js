// Refactored to improve modularity and remove redundant logic.
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/html/settings.html")
    });
});