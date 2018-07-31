import React, {Component} from "react";
import {connect} from "react-redux";

import {refreshFiles} from "./actions";

/** @type {{[key:string]: React.CSSProperties}} */
const styles = {
  container: {
    width: "100%"
  },
  imageContainer: {
    float: "left"
  },
  image: {
    maxHeight: "150px"
  }
};

class App extends Component {
  render() {
    return (
      <div>
        <button onClick={this.props.onRefreshClick}>Refresh</button>
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
