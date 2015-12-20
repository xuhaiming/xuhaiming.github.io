"use strict";

var React = require('react');
var TopSection = require('./topSection.jsx');
var BlogListSection = require('./blogListSection.jsx');
var AboutSection = require('./aboutSection.jsx');
var ContactSection = require('./contactSection.jsx');

class Content extends React.Component {
    render() {
        return (
            <div id="main">
                <TopSection />
                <BlogListSection />
                <AboutSection />
                <ContactSection />
            </div>
        )
    }
}

module.exports = Content;
