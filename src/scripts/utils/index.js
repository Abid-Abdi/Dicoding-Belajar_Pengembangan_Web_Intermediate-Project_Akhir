export function showFormattedDate(date, locale = 'en-US', options = {}) {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

export function sleep(time = 1000) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// Menampilkan loader
export function showGlobalLoader() {
  const loaderElement = document.getElementById('global-loader');
  loaderElement.classList.add('show');
}

// Menyembunyikan loader
export function hideGlobalLoader() {
  const loaderElement = document.getElementById('global-loader');
  loaderElement.classList.remove('show');
}