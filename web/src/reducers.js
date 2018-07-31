import {combineReducers} from "redux";

import {SET_FILES} from "./actions";

export function files(state = [], action) {
  switch (action.type) {
    case SET_FILES:
      return action.files;
    default:
      return state;
  }
}

export const rootReducer = combineReducers({
  files
});
