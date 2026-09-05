import localforage from 'localforage';

localforage.config({
  name: 'ZimplyContentStudio',
  storeName: 'quickbook_drafts',
  description: 'Stores auto-saved drafts for Quickbook Creator'
});

export const saveDraft = async (draftId, draftData) => {
  try {
    const payload = { ...draftData, updatedAt: Date.now() };
    await localforage.setItem(draftId, payload);
    return true;
  } catch (err) {
    console.error('Error saving draft:', err);
    return false;
  }
};

export const loadDraft = async (draftId) => {
  try {
    return await localforage.getItem(draftId);
  } catch (err) {
    console.error('Error loading draft:', err);
    return null;
  }
};

export const deleteDraft = async (draftId) => {
  try {
    await localforage.removeItem(draftId);
    return true;
  } catch (err) {
    console.error('Error deleting draft:', err);
    return false;
  }
};

export const getAllDrafts = async () => {
  try {
    const drafts = [];
    await localforage.iterate((value, key) => {
      if (key.startsWith('draft-')) {
        let title = 'Untitled Draft';
        let subject = 'Unknown';
        try { 
           if (value.metaJson) {
               const meta = JSON.parse(value.metaJson);
               title = meta.title || title;
               subject = meta.subject || subject;
           }
        } catch(e) {}
        drafts.push({
          id: key,
          title,
          subject,
          updatedAt: value.updatedAt,
          pageCount: value.pages ? value.pages.length : 0
        });
      }
    });
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('Error getting all drafts:', err);
    return [];
  }
};
