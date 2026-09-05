import mammoth from 'mammoth/mammoth.browser';
self.onmessage = async ({ data }) => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: data.buffer });
    const blocks = result.value
      .split(/\n\s*\n/)
      .map((text) => ({ text: text.trim() }))
      .filter((b) => b.text);
    self.postMessage({ blocks });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
