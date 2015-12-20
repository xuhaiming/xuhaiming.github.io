"use strict";

var React = require('react');
var ReactDOM = require('react-dom');

var Header = require('./sections/header.jsx');
var Content = require('./sections/content.jsx');
var Footer = require('./sections/footer.jsx');

class MainComponent extends React.Component {
    render() {
        return (
            <div>
                <Header isRootPage={true}/>
                <Content />
                <Footer />
            </div>
        );
    }
}

ReactDOM.render(
    <MainComponent />,
    document.getElementById('main-page')
);