"use strict";

var React = require('react');

class BlogContent extends React.Component {
    createMarkup() {
        return {__html: this.props.content};
    }

    render() {
        return (
            <div id="main">
                <section id="top" className="two">
                    <div className="container blog-detail">
                        <header>
                            <h2>This is a <strong>Title</strong></h2>
                            <div dangerouslySetInnerHTML={this.createMarkup()}></div>
                        </header>
                    </div>
                </section>
            </div>
        );
    }
}

module.exports = BlogContent;