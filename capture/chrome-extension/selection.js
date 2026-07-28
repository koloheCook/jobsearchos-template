export function selectedDom() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return { error: "Select the visible top-frame job-description text, then reopen this popup." };
  const holder = document.createElement("div");
  holder.append(selection.getRangeAt(0).cloneContents());
  return { html: [...holder.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join(""), url: location.href, title: document.title };
}

export async function snapshotActiveSelection(chromeApi) {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const results = await chromeApi.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", func: selectedDom });
  return results[0]?.result || { error: "The selection could not be read." };
}
