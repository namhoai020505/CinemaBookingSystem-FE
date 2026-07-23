export const CINEMA_SELECTION_STORAGE_KEY = "g2c-selected-cinema-id";
export const CINEMA_SELECTION_EVENT = "g2c-cinema-selection-change";

export const readSelectedCinemaId = () =>
  localStorage.getItem(CINEMA_SELECTION_STORAGE_KEY) || "";

export const writeSelectedCinemaId = (cinemaId: string) => {
  if (cinemaId) {
    localStorage.setItem(CINEMA_SELECTION_STORAGE_KEY, cinemaId);
  } else {
    localStorage.removeItem(CINEMA_SELECTION_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(CINEMA_SELECTION_EVENT, { detail: { cinemaId } }),
  );
};
