"use strict";

var React = require('react');
var ReactDOM = require('react-dom');
var { Router, Route } = require('react-router');
var $ = require('jquery');

require('../sass/style.scss');

var Header = require('../sections/header.jsx');
var BlogContent = require('./blogContent.jsx');
var Footer = require('../sections/footer.jsx');


class BlogPage extends React.Component {
    constructor() {
        super();
        this.state = {
            htmlContent: null
        }
    }

    componentDidMount() {
        hljs.initHighlightingOnLoad();
        var blogUrl = this.props.params.blogUrl;
        $.get(blogUrl + ".html", (htmlContent) => {
            this.setState({htmlContent: htmlContent}, () => {
                $('pre code').each((i, block) => {
                    hljs.highlightBlock(block);
                });
            });
        });
    }

    render() {
        return (
            <div>
                <Header isRootPage={false}/>
                <BlogContent
                    blogUrl = {this.props.params.blogUrl}
                    content={this.state.htmlContent}/>
                <Footer />
            </div>
        );
    }
}

ReactDOM.render(
    <Router>
        <Route path="/:blogUrl" component={BlogPage} />
        <Route path="/" component={BlogPage} />
    </Router>,
    document.getElementById('blog-page')
);