function getTokyoToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

module.exports = { getTokyoToday };