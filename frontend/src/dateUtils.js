/**
 * Tarih yardımcı fonksiyonları. Gerektiğinde burada genişletebilirsiniz.
 */
export const formatDate = (date) => {
  return new Date(date).toISOString().slice(0, 10);
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};