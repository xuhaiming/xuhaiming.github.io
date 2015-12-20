"use strict";

var React = require('react');
var _ = require('lodash');
var moment = require('moment');
var BlogListConfig = require('../blogListConfig.jsx');

class BlogContent extends React.Component {
    createMarkup() {
        return {__html: this.props.content};
    }

    getBlogTitle() {
        var words = this.props.blogUrl.split('-');
        var blog = _.find(BlogListConfig, (item) => {
            return item.title.toLowerCase() === _.drop(words, 3).join(' ');
        });
        return blog.title;
    }

    getBlogDate() {
        var dateString = this.props.blogUrl.substring(0, 10);
        return moment(dateString).format('MMMM Do, YYYY');
    }

    render() {
        return (
            <div id="main">
                <section id="top" className="two">
                    <div className="container blog-detail">
                        <header>
                            <h2>{this.getBlogTitle()}</h2>
                            <div>{this.getBlogDate()}</div>
                            <div className="text-content" dangerouslySetInnerHTML={this.createMarkup()}></div>
                        </header>
                    </div>
                </section>
            </div>
        );
    }
}

module.exports = BlogContent;