"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

class MainComponent extends React.Component {
    render() {
        return <div>Hello World</div>;
    }
}

ReactDOM.render(
    <MainComponent />,
    document.getElementById('main-page')
);