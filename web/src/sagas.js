import {call, put, takeLatest} from "redux-saga/effects";

import {REFRESH_FILES, setFiles} from "./actions";

function* getFiles() {
  const response = yield call(fetch, "/api/files");
  const files = yield response.json();
  yield put(setFiles(files));
}

export function* rootSaga() {
  yield takeLatest(REFRESH_FILES, getFiles);
}
