module.exports = async function ready(base) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { }
    await new Promise(resolve => setTimeout(resolve,250));
  }
  throw new Error('Cypher preview did not become ready: ' + base);
};
