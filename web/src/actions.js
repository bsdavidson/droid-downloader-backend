export const REFRESH_FILES = "REFRESH_FILES";
export const SET_FILES = "SET_FILES";

export function refreshFiles() {
  return {type: REFRESH_FILES};
}

export function setFiles(files) {
  return {type: SET_FILES, files};
}
