// Script to clear cached language preferences
console.log('Note: This script shows how to clear language cache in browser.');
console.log('To clear language cache, run the following in your browser console:');
console.log('');
console.log('// Clear language cache');
console.log('Object.keys(localStorage).filter(key => key.includes("staylabel_language") || key.includes("i18nextLng")).forEach(key => {');
console.log('  console.log("Clearing:", key, "=", localStorage.getItem(key));');
console.log('  localStorage.removeItem(key);');
console.log('});');
console.log('');
console.log('// Also clear cookies');
console.log('document.cookie = "staylabel_language=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";');
console.log('document.cookie = "i18next=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";');
console.log('');
console.log('Then refresh the page to test the fix.');
