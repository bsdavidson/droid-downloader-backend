import React, {Component} from "react";
import {connect} from "react-redux";

import {refreshFiles} from "./actions";

/** @type {{[key:string]: React.CSSProperties}} */
const styles = {
  container: {
    width: "100%"
  },
  imageContainer: {
    float: "left",
    padding: "0.4rem"
  },
  image: {
    borderRadius: "0.4rem",
    boxShadow: "0 0 5px #333333",
    maxHeight: "125px"
  },
  refresh: {
    background: "#efefef",
    border: "1px solid #555555",
    borderRadius: "0.4rem",
    cursor: "pointer",
    fontSize: "1.1rem",
    lineHeight: "1",
    margin: "0.2rem",
    padding: "0.7rem 1rem 0.6rem 1rem",
    textAlign: "center",
    display: "inline-block"
  }
};

class App extends Component {
  render() {
    return (
      <div>
        <a style={styles.refresh} onClick={this.props.onRefreshClick}>
          Refresh
        </a>
        <div style={styles.container}>
          {this.props.files &&
            this.props.files.map(f => (
              <div style={styles.imageContainer} key={f.filePath}>
                <img style={styles.image} src={`/thumbs/${f.fileID}.jpg`} />
              </div>
            ))}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    files: state.files
  };
}

function mapDispatchToProps(dispatch) {
  return {
    onRefreshClick: () => dispatch(refreshFiles())
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
